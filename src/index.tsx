/**
 * HealthGrid AI Triage Server - Hono Implementation
 * Complete healthcare triage system with Gupshup WhatsApp integration
 * Handles medical triage conversations through WhatsApp Business API
 */
import { config } from 'dotenv'
import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { logger } from 'hono/logger'
import { serveStatic } from 'hono/cloudflare-workers'

// Load environment variables in development
if (process.env.NODE_ENV !== 'production') {
    config()
}

// Import healthcare services
import { MySQLService, DatabaseConfig } from './services/mysqlService'
import { SessionManager } from './services/sessionManager'
import { ConversationFlowManager } from './services/conversationFlowManager'
import { GupshupService } from './services/gupshupService'
import { WebhookHandler } from './services/webhookHandler'
import { TelemedicineService } from './services/telemedicineService'
import { PrescriptionService } from './services/prescriptionService'
import { HealthRecordService } from './services/healthRecordService'
import { InsuranceService } from './services/insuranceService'
import { HMOService } from './services/hmoService'
import { DiagnosticLabService } from './services/diagnosticLabService'
import { ChatService } from './services/chatService'
import { FlutterwaveService } from './services/flutterwaveService'
import { chatRoutes, initializeChatRoutes } from './api/chatRoutes'

// Types for environment bindings
type Bindings = {
    DB_HOST?: string;
    DB_PORT?: string;
    DB_DATABASE?: string;
    DB_USERNAME?: string;
    DB_PASSWORD?: string;
    GUPSHUP_API_KEY?: string;
    GUPSHUP_SOURCE_NUMBER?: string;
    FLUTTERWAVE_PUBLIC_KEY?: string;
    FLUTTERWAVE_SECRET_KEY?: string;
    BASE_URL?: string;
    NODE_ENV?: string;
}

const app = new Hono<{ Bindings: Bindings }>()

// Global variables for services
let mysqlService: MySQLService
let sessionManager: SessionManager
let conversationManager: ConversationFlowManager
let gupshupService: GupshupService
let webhookHandler: WebhookHandler
let telemedicineService: TelemedicineService
let prescriptionService: PrescriptionService
let healthRecordService: HealthRecordService
let insuranceService: InsuranceService
let hmoService: HMOService
let diagnosticLabService: DiagnosticLabService
let chatService: ChatService
let flutterwaveService: FlutterwaveService

// Middleware
app.use('*', logger())

// Middleware to initialize services on first API request
app.use('/api/*', async (c, next) => {
    if (!webhookHandler) {
        // Use process.env in development, c.env in production
        const env = process.env.NODE_ENV !== 'production' ? process.env as any : c.env
        await initializeServices(env)
    }
    await next()
})
app.use('/api/*', cors())
app.use('/static/*', serveStatic({ root: './public', manifest: {} }))

/**
 * Initialize all healthcare services
 */
async function initializeServices(env: Bindings) {
    try {
        console.log('🚀 Initializing HealthGrid services...')

        // Initialize MySQL Service
        // const dbConfig: DatabaseConfig = {
        //     host: env.DB_HOST || '127.0.0.1',
        //     port: parseInt(env.DB_PORT || '3306'),
        //     database: env.DB_DATABASE || 'healthgrid_triage',
        //     user: env.DB_USERNAME || 'root',
        //     password: env.DB_PASSWORD || ''
        // }
        const dbConfig: DatabaseConfig = {
            host: env.DB_HOST || '77.37.35.61',
            port: parseInt(env.DB_PORT || '3306'),
            database: env.DB_DATABASE || 'u280643084_healthgrid',
            user: env.DB_USERNAME || 'u280643084_healthgrid',
            password: env.DB_PASSWORD || 'HealthGrid@123'
        }

        mysqlService = new MySQLService(dbConfig)
        await mysqlService.init()
        console.log('✅ MySQL service initialized')

        // Initialize session manager with MySQL
        sessionManager = new SessionManager(mysqlService)
        await sessionManager.init()

        // Initialize health record service
        healthRecordService = new HealthRecordService(mysqlService)

        // Initialize insurance and HMO services
        insuranceService = new InsuranceService(healthRecordService)
        hmoService = new HMOService(healthRecordService, insuranceService)

        // Initialize prescription service
        prescriptionService = new PrescriptionService(healthRecordService, insuranceService)

        // Initialize diagnostic lab service
        diagnosticLabService = new DiagnosticLabService(healthRecordService, insuranceService, hmoService)

        // Initialize telemedicine service
        telemedicineService = new TelemedicineService()

        // Initialize conversation manager
        conversationManager = new ConversationFlowManager(sessionManager)

        // Initialize Gupshup service
        if (env.GUPSHUP_API_KEY && env.GUPSHUP_SOURCE_NUMBER) {
            gupshupService = new GupshupService(env.GUPSHUP_API_KEY, env.GUPSHUP_SOURCE_NUMBER)
            console.log('✅ Gupshup service initialized')
        } else {
            console.log('⚠️ Gupshup credentials not provided - using mock service')
            gupshupService = new GupshupService('mock_key', 'mock_number')
        }

        // Initialize chat service
        chatService = new ChatService(mysqlService)
        console.log('✅ Chat service initialized')

        // Initialize Flutterwave service
        flutterwaveService = new FlutterwaveService()
        console.log('✅ Flutterwave service initialized')

        // Initialize webhook handler
        webhookHandler = new WebhookHandler(sessionManager, conversationManager, gupshupService, chatService)

        // Initialize chat routes
        initializeChatRoutes(mysqlService)
        console.log('✅ Chat routes initialized')

        console.log('✅ All HealthGrid services initialized successfully')

    } catch (error: unknown) {
        console.error('❌ Service initialization failed:', error)
        throw error
    }
}

/**
 * Main Gupshup webhook endpoint
 * Handles all incoming WhatsApp messages
 */
app.post('/webhook', async (c) => {
    try {
        const env = c.env

        // Initialize services if not already done
        if (!webhookHandler) {
            await initializeServices(env)
        }

        // Get request body
        const body = await c.req.json()

        // Process through webhook handler
        const result = await webhookHandler.processWebhook(body)

        return c.json({
            status: 'success',
            messageId: result.messageId,
            timestamp: new Date().toISOString()
        })

    } catch (error: unknown) {
        console.error('Webhook processing failed:', error)
        return c.json({
            error: 'Internal server error',
            timestamp: new Date().toISOString()
        }, 500)
    }
})

/**
 * Health check endpoint
 */
app.get('/health', async (c) => {
    try {
        const healthData = {
            status: 'healthy',
            timestamp: new Date().toISOString(),
            services: {
                sessionManager: sessionManager ? 'connected' : 'disconnected',
                conversationManager: conversationManager ? 'ready' : 'not ready',
                gupshupService: gupshupService ? 'configured' : 'not configured',
                webhookHandler: webhookHandler ? 'ready' : 'not ready',
                telemedicineService: telemedicineService ? 'ready' : 'not ready',
                prescriptionService: prescriptionService ? 'ready' : 'not ready',
                healthRecordService: healthRecordService ? 'ready' : 'not ready',
                insuranceService: insuranceService ? 'ready' : 'not ready',
                hmoService: hmoService ? 'ready' : 'not ready',
                diagnosticLabService: diagnosticLabService ? 'ready' : 'not ready'
            },
            environment: c.env.NODE_ENV || 'development'
        }

        return c.json(healthData)

    } catch (error: unknown) {
        console.error('Health check failed:', error)
        return c.json({
            status: 'unhealthy',
            error: error instanceof Error ? error.message : 'Unknown error',
            timestamp: new Date().toISOString()
        }, 500)
    }
})

/**
 * API endpoints for healthcare services
 */

// Telemedicine consultation endpoints
app.post('/api/consultations/schedule', async (c) => {
    try {
        const { sessionId, providerId, preferredTime } = await c.req.json()
        const session = await sessionManager.getSession(sessionId)
        const provider = { id: providerId, name: 'Provider Name' } // This would come from provider service

        const consultation = await telemedicineService.scheduleVideoConsultation(
            session,
            provider,
            new Date(preferredTime)
        )

        return c.json({ success: true, consultation })
    } catch (error: unknown) {
        return c.json({ error: error instanceof Error ? error.message : 'Unknown error' }, 400)
    }
})

// Prescription management endpoints
app.post('/api/prescriptions', async (c) => {
    try {
        const { consultationId, prescriptionData } = await c.req.json()
        // This would integrate with consultation data
        const session = {} as any // Get session from consultation

        const prescription = await prescriptionService.createPrescription(
            consultationId,
            prescriptionData,
            session
        )

        return c.json({ success: true, prescription })
    } catch (error: unknown) {
        return c.json({ error: error instanceof Error ? error.message : 'Unknown error' }, 400)
    }
})

// Insurance verification endpoint
app.post('/api/insurance/verify', async (c) => {
    try {
        const { insuranceInfo, patientData } = await c.req.json()

        const verification = await insuranceService.verifyInsuranceEligibility(
            insuranceInfo,
            patientData
        )

        return c.json({ success: true, verification })
    } catch (error: unknown) {
        return c.json({ error: error instanceof Error ? error.message : 'Unknown error' }, 400)
    }
})

// HMO enrollment verification
app.post('/api/hmo/verify', async (c) => {
    try {
        const { membershipInfo } = await c.req.json()
        const session = {} as any // Get session context

        const enrollment = await hmoService.verifyHMOEnrollment(membershipInfo, session)

        return c.json({ success: true, enrollment })
    } catch (error: unknown) {
        return c.json({ error: error instanceof Error ? error.message : 'Unknown error' }, 400)
    }
})

// Lab referral endpoints
app.post('/api/lab/referral', async (c) => {
    try {
        const { consultationId, labOrders } = await c.req.json()
        const session = {} as any // Get session from consultation
        const providerInfo = {} as any // Get provider info

        const referral = await diagnosticLabService.processLabReferral(
            consultationId,
            labOrders,
            session,
            providerInfo
        )

        return c.json({ success: true, referral })
    } catch (error: unknown) {
        return c.json({ error: error instanceof Error ? error.message : 'Unknown error' }, 400)
    }
})

// Payment endpoints
app.post('/api/payment/create', async (c) => {
    try {
        const { email, phone, name, sessionId } = await c.req.json()
        
        if (!email || !phone || !name || !sessionId) {
            return c.json({ error: 'Missing required fields: email, phone, name, sessionId' }, 400)
        }
        
        const paymentLink = await flutterwaveService.createPaymentLink({
            email,
            phone,
            name,
            sessionId
        })
        
        return c.json({ success: true, paymentLink })
    } catch (error: unknown) {
        console.error('Payment creation error:', error)
        return c.json({ error: error instanceof Error ? error.message : 'Payment creation failed' }, 500)
    }
})

app.get('/api/payment/callback', async (c) => {
    try {
        const transactionId = c.req.query('transaction_id')
        const txRef = c.req.query('tx_ref')
        
        if (!transactionId || !txRef) {
            return c.json({ error: 'Missing transaction parameters' }, 400)
        }
        
        const result = await flutterwaveService.handleCallback(transactionId, txRef)
        
        if (result.success) {
            // Redirect to success page with session info
            const redirectUrl = result.sessionId 
                ? `/?session=${result.sessionId}&payment=success`
                : '/?payment=success'
            return c.redirect(redirectUrl)
        } else {
            return c.redirect('/?payment=failed')
        }
    } catch (error: unknown) {
        console.error('Payment callback error:', error)
        return c.redirect('/?payment=error')
    }
})

app.post('/api/payment/verify', async (c) => {
    try {
        const { transactionId } = await c.req.json()
        
        if (!transactionId) {
            return c.json({ error: 'Transaction ID is required' }, 400)
        }
        
        const isVerified = await flutterwaveService.verifyTransaction(transactionId)
        
        return c.json({ success: true, verified: isVerified })
    } catch (error: unknown) {
        console.error('Payment verification error:', error)
        return c.json({ error: error instanceof Error ? error.message : 'Verification failed' }, 500)
    }
})

// Mount chat API routes
// Middleware to ensure services are initialized before API calls
app.use('/api/*', async (c, next) => {
    if (!mysqlService) {
        await initializeServices(c.env)
    }
    await next()
})

app.route('/api/chat', chatRoutes)

/**
 * Default route - Healthcare Platform Interface
 */


app.get('/', (c) => {
    return c.html(`
    <!DOCTYPE html>
    <html lang="en">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>HealthGrid AI Triage - Complete Healthcare Ecosystem</title>
        <script src="https://cdn.tailwindcss.com"></script>
        <link href="https://cdn.jsdelivr.net/npm/@fortawesome/fontawesome-free@6.4.0/css/all.min.css" rel="stylesheet">
        <link href="/static/style.css" rel="stylesheet">
        <style>
            @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&display=swap');
            
            * {
                font-family: 'Inter', sans-serif;
            }
            
            body {
                margin: 0;
                padding: 0;
                background: linear-gradient(135deg, rgba(14, 165, 233, 0.9) 0%, rgba(6, 182, 212, 0.9) 50%, rgba(16, 185, 129, 0.9) 100%), url('/bg1.jpg');
                background-size: cover;
                background-position: center;
                background-attachment: fixed;
                min-height: 100vh;
            }
            
            .gradient-bg {
                background: linear-gradient(135deg, #e8f4fd 0%, #f0f9ff 50%, #ffffff 100%);
            }
            
            .healthcare-gradient {
                background: linear-gradient(135deg, #0ea5e9 0%, #06b6d4 50%, #10b981 100%);
            }
            
            .glass-effect {
                background: rgba(255, 255, 255, 0.9);
                backdrop-filter: blur(20px);
                border: 1px solid rgba(14, 165, 233, 0.1);
                box-shadow: 0 8px 32px rgba(14, 165, 233, 0.1);
            }
            
            .medical-card {
                background: white;
                border: 1px solid #e2e8f0;
                box-shadow: 0 4px 20px rgba(14, 165, 233, 0.08);
                transition: all 0.3s ease;
            }
            
            .medical-card:hover {
                transform: translateY(-2px);
                box-shadow: 0 8px 30px rgba(14, 165, 233, 0.15);
                border-color: #0ea5e9;
            }
            
            .chat-bubble {
                animation: float 3s ease-in-out infinite;
            }
            
            @keyframes float {
                0%, 100% { transform: translateY(0px); }
                50% { transform: translateY(-10px); }
            }
            
            /* Typing Indicator Animation */
            .typing-indicator {
                display: flex;
                align-items: center;
            }
            
            .typing-dot {
                width: 8px;
                height: 8px;
                border-radius: 50%;
                background-color: rgba(255, 255, 255, 0.7);
                animation: typing 1.4s infinite ease-in-out;
            }
            
            .typing-dot:nth-child(1) {
                animation-delay: -0.32s;
            }
            
            .typing-dot:nth-child(2) {
                animation-delay: -0.16s;
            }
            
            @keyframes typing {
                0%, 80%, 100% {
                    transform: scale(0);
                    opacity: 0.5;
                }
                40% {
                    transform: scale(1);
                    opacity: 1;
                }
            }
            
            /* Chat Message Animations */
            #chatMessages > div {
                animation: slideInMessage 0.3s ease-out;
            }
            
            @keyframes slideInMessage {
                from {
                    opacity: 0;
                    transform: translateY(20px);
                }
                to {
                    opacity: 1;
                    transform: translateY(0);
                }
            }
            
            /* Pulse Animation for Online Status */
            @keyframes pulse {
                0%, 100% {
                    opacity: 1;
                }
                50% {
                    opacity: 0.5;
                }
            }
            
            /* Hover Effects for Interactive Elements */
            .glass-effect:hover {
                transform: translateY(-2px);
                box-shadow: 0 10px 25px rgba(0, 0, 0, 0.2);
            }
            
            /* Smooth Scrollbar for Chat */
            #chatMessages::-webkit-scrollbar {
                width: 6px;
            }
            
            #chatMessages::-webkit-scrollbar-track {
                background: rgba(255, 255, 255, 0.1);
                border-radius: 3px;
            }
            
            #chatMessages::-webkit-scrollbar-thumb {
                background: rgba(255, 255, 255, 0.3);
                border-radius: 3px;
            }
            
            #chatMessages::-webkit-scrollbar-thumb:hover {
                background: rgba(255, 255, 255, 0.5);
            }
            
            /* Page Navigation Styles */
            .page-container {
                display: none;
            }
            
            .page-container.active {
                display: block;
            }
            
            .nav-link {
                color: #6B7280;
                font-weight: 500;
                padding: 0.5rem 1rem;
                border-radius: 0.5rem;
                transition: all 0.3s ease;
            }
            
            .nav-link:hover {
                color: #0EA5E9;
                background-color: #F0F9FF;
            }
            
            .nav-link.active {
                 color: #0EA5E9;
                 background-color: #EFF6FF;
                 font-weight: 600;
             }
             
             /* Enhanced Language Switcher Styles */
             .language-option {
                 transition: all 0.2s ease;
                 border-radius: 0.375rem;
             }
             
             .language-option:hover {
                 background-color: #EBF8FF;
                 color: #1E40AF;
             }
             
             .language-option.active {
                 background-color: #DBEAFE;
                 color: #1E40AF;
                 font-weight: 600;
             }
             
             .language-option.active::after {
                 content: '✓';
                 margin-left: auto;
                 color: #10B981;
                 font-weight: bold;
             }
             
             #languageDropdown {
                 box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04);
                 backdrop-filter: blur(10px);
                 border: 1px solid rgba(255, 255, 255, 0.2);
             }
             
             #languageToggle:hover {
                 transform: translateY(-1px);
                 box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
             }
            
            .pulse-ring {
                animation: pulse-ring 1.25s cubic-bezier(0.215, 0.61, 0.355, 1) infinite;
            }
            
            @keyframes pulse-ring {
                0% {
                    transform: scale(.33);
                }
                80%, 100% {
                    opacity: 0;
                }
            }
            
            .typing-indicator {
                display: inline-flex;
                align-items: center;
            }
            
            .typing-dot {
                width: 8px;
                height: 8px;
                border-radius: 50%;
                background-color: #9CA3AF;
                animation: typing 1.4s infinite ease-in-out;
            }
            
            .typing-dot:nth-child(1) { animation-delay: -0.32s; }
            .typing-dot:nth-child(2) { animation-delay: -0.16s; }
            
            @keyframes typing {
                0%, 80%, 100% {
                    transform: scale(0);
                }
                40% {
                    transform: scale(1);
                }
            }
        </style>
    </head>
    <body class="gradient-bg min-h-screen text-gray-800">
        <!-- Navigation -->
        <nav class="bg-white/95 backdrop-blur-md border-b border-gray-200 sticky top-0 z-50">
            <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                <div class="flex justify-between items-center h-16">
                    <div class="flex items-center space-x-8">
                        <div class="flex items-center">
                            <div class="w-10 h-10 healthcare-gradient rounded-lg flex items-center justify-center mr-3">
                                <i class="fas fa-heartbeat text-white text-lg"></i>
                            </div>
                            <span class="text-xl font-bold text-gray-800">HealthGrid</span>
                        </div>
                        <div class="hidden md:flex space-x-6">
                            <a href="#" class="nav-link active" data-page="main">Main App</a>
                            <a href="#" class="nav-link" data-page="solution">Our Solution</a>
                        </div>
                    </div>
                    <div class="flex items-center space-x-4">
                        <button class="medical-primary px-4 py-2 rounded-lg text-sm font-medium">
                            <i class="fab fa-whatsapp mr-2"></i>
                            Start Chat
                        </button>
                    </div>
                </div>
            </div>
        </nav>
        
        <!-- Main App Page -->
        <div id="mainPage" class="page-container active">
            <div class="container mx-auto px-4 py-8">
                <!-- Header -->
                <div class="text-center mb-16">
                    <div class="flex items-center justify-center mb-6">
                        <div class="relative">
                            <div class="absolute inset-0 pulse-ring bg-red-500 rounded-full opacity-75"></div>
                            <i class="fas fa-heartbeat text-6xl text-red-500 relative z-10"></i>
                        </div>
                        <h1 class="text-5xl font-bold text-gray-800 ml-6" data-translate="title">HealthGrid Africa</h1>
                    </div>
                    <p class="text-2xl text-gray-700 font-light" data-translate="subtitle">Healthcare That Speaks Your Language</p>
                    <p class="text-lg text-gray-600 mt-2" data-translate="description">Complete Healthcare Ecosystem for Nigeria</p>
                </div>

            <!-- Live Chat Interface -->
            <div class="grid lg:grid-cols-3 gap-8 mb-16">
                <!-- Chat Interface -->
                <div class="lg:col-span-2">
                    <div class="medical-card rounded-2xl p-6 h-96">
                        <div class="flex items-center justify-between mb-4">
                            <h3 class="text-xl font-bold text-gray-800" data-translate="chat-title">Live Chat ith Doctor</h3>
                            <div class="flex items-center space-x-4">
                                <div class="flex items-center space-x-2">
                                    <div class="w-3 h-3 bg-green-500 rounded-full animate-pulse"></div>
                                    <span class="text-gray-600 text-sm" data-translate="online">Online</span>
                                </div>
                                <!-- Language Pills -->
                                <div class="flex flex-wrap gap-1">
                                    <button class="language-pill px-2 py-1 rounded-full text-xs font-medium border border-blue-200 bg-blue-50 text-blue-700 transition-all active" data-lang="en">
                                        🇺🇸 EN
                                    </button>
                                    <button class="language-pill px-2 py-1 rounded-full text-xs font-medium border border-gray-200 bg-gray-50 text-gray-600 hover:border-blue-200 hover:bg-blue-50 hover:text-blue-700 transition-all" data-lang="yo">
                                        🇳🇬 YO
                                    </button>
                                    <button class="language-pill px-2 py-1 rounded-full text-xs font-medium border border-gray-200 bg-gray-50 text-gray-600 hover:border-blue-200 hover:bg-blue-50 hover:text-blue-700 transition-all" data-lang="ha">
                                        🇳🇬 HA
                                    </button>
                                    <button class="language-pill px-2 py-1 rounded-full text-xs font-medium border border-gray-200 bg-gray-50 text-gray-600 hover:border-blue-200 hover:bg-blue-50 hover:text-blue-700 transition-all" data-lang="ig">
                                        🇳🇬 IG
                                    </button>
                                    <button class="language-pill px-2 py-1 rounded-full text-xs font-medium border border-gray-200 bg-gray-50 text-gray-600 hover:border-blue-200 hover:bg-blue-50 hover:text-blue-700 transition-all" data-lang="pcm">
                                        🇳🇬 PC
                                    </button>
                                </div>
                            </div>
                        </div>
                        
                        <!-- Chat Messages -->
                        <div id="chatMessages" class="h-64 overflow-y-auto mb-4 space-y-3">
                            <!-- Doctor Message -->
                            <div class="flex items-start space-x-3">
                                <div class="w-8 h-8 bg-blue-500 rounded-full flex items-center justify-center">
                                    <i class="fas fa-user-md text-white text-xs"></i>
                                </div>
                                <div class="bg-blue-50 border border-blue-200 rounded-lg p-3 max-w-xs">
                                    <p class="text-gray-800 text-sm" data-translate="doctor-greeting">Hello! I'm Dr. Sarah. How can I help you today?</p>
                                    <span class="text-gray-500 text-xs">2 min ago</span>
                                </div>
                            </div>
                            
                            <!-- Patient Message -->
                            <div class="flex items-start space-x-3 justify-end">
                                <div class="bg-green-50 border border-green-200 rounded-lg p-3 max-w-xs">
                                    <p class="text-gray-800 text-sm" data-translate="patient-message">I've been having chest pain for the past hour</p>
                                    <span class="text-gray-500 text-xs">1 min ago</span>
                                </div>
                                <div class="w-8 h-8 bg-green-500 rounded-full flex items-center justify-center">
                                    <i class="fas fa-user text-white text-xs"></i>
                                </div>
                            </div>
                            
                            <!-- Typing Indicator -->
                            <div class="flex items-start space-x-3">
                                <div class="w-8 h-8 bg-blue-500 rounded-full flex items-center justify-center">
                                    <i class="fas fa-user-md text-white text-xs"></i>
                                </div>
                                <div class="bg-gray-100 border border-gray-200 rounded-lg p-3">
                                    <div class="typing-indicator">
                                        <div class="typing-dot"></div>
                                        <div class="typing-dot mx-1"></div>
                                        <div class="typing-dot"></div>
                                    </div>
                                </div>
                            </div>
                        </div>
                        
                        <!-- Chat Input -->
                        <div class="mt-4 p-4 bg-white rounded-lg border border-gray-200 shadow-sm">
                            <div class="flex space-x-2">
                                <input type="text" id="chatInput" placeholder="Type your message..." 
                                       class="flex-1 border border-gray-300 rounded-lg px-4 py-3 text-gray-800 placeholder-gray-500 focus:border-blue-500 focus:ring-2 focus:ring-blue-200 outline-none" 
                                       data-translate-placeholder="chat-placeholder">
                                <button id="sendMessage" class="bg-blue-500 hover:bg-blue-600 text-white px-4 py-3 rounded-lg transition-all">
                                    <i class="fas fa-paper-plane"></i>
                                </button>
                                <button id="voiceCall" class="bg-green-500 hover:bg-green-600 text-white px-4 py-3 rounded-lg transition-all">
                                    <i class="fas fa-phone"></i>
                                </button>
                                <button id="videoCall" class="bg-purple-500 hover:bg-purple-600 text-white px-4 py-3 rounded-lg transition-colors">
                                    <i class="fas fa-video"></i>
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
                
                <!-- Quick Actions -->
                <div class="space-y-4">
                    <div class="medical-card rounded-2xl p-6">
                        <h4 class="text-lg font-bold text-gray-800 mb-4" data-translate="quick-actions">Quick Actions</h4>
                        <div class="space-y-3">
                            <button id="emergencyBtn" class="w-full bg-red-50 border border-red-200 rounded-lg p-3 text-gray-800 hover:bg-red-100 transition-colors flex items-center">
                                <i class="fas fa-ambulance mr-3 text-red-500"></i>
                                <span data-translate="emergency">Emergency</span>
                            </button>
                            <button id="appointmentBtn" class="w-full bg-blue-50 border border-blue-200 rounded-lg p-3 text-gray-800 hover:bg-blue-100 transition-colors flex items-center">
                                <i class="fas fa-calendar-alt mr-3 text-blue-500"></i>
                                <span data-translate="book-appointment">Book Appointment</span>
                            </button>
                            <button id="prescriptionsBtn" class="w-full bg-purple-50 border border-purple-200 rounded-lg p-3 text-gray-800 hover:bg-purple-100 transition-colors flex items-center">
                                <i class="fas fa-pills mr-3 text-purple-500"></i>
                                <span data-translate="prescriptions">Prescriptions</span>
                            </button>
                            <button id="healthRecordsBtn" class="w-full bg-green-50 border border-green-200 rounded-lg p-3 text-gray-800 hover:bg-green-100 transition-colors flex items-center">
                                <i class="fas fa-file-medical mr-3 text-green-500"></i>
                                <span data-translate="health-records">Health Records</span>
                            </button>
                        </div>
                    </div>
                    
                    <!-- Doctor Info -->
                    <div class="medical-card rounded-2xl p-6">
                        <h4 class="text-lg font-bold text-gray-800 mb-4" data-translate="current-doctor">Current Doctor</h4>
                        <div class="flex items-center space-x-3">
                            <div class="w-12 h-12 bg-blue-500 rounded-full flex items-center justify-center">
                                <i class="fas fa-user-md text-white"></i>
                            </div>
                            <div>
                                <p class="text-gray-800 font-semibold">Dr. Pelumi</p>
                                <p class="text-gray-600 text-sm">General Practitioner</p>
                                <div class="flex items-center mt-1">
                                    <div class="flex text-yellow-400">
                                        <i class="fas fa-star text-xs"></i>
                                        <i class="fas fa-star text-xs"></i>
                                        <i class="fas fa-star text-xs"></i>
                                        <i class="fas fa-star text-xs"></i>
                                        <i class="fas fa-star text-xs"></i>
                                    </div>
                                    <span class="text-gray-500 text-xs ml-2">4.9 (127 reviews)</span>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
            
            <!-- Six Core Features -->
            <!-- Call to Action for Solutions -->
          

            <!-- System Status -->
            <div class="medical-card rounded-2xl p-6 mb-8">
                <h3 class="text-xl font-bold mb-4 flex items-center text-gray-800">
                    <i class="fas fa-heartbeat text-green-500 mr-2"></i>
                    System Status
                </h3>
                <div id="system-status" class="grid md:grid-cols-2 lg:grid-cols-4 gap-4">
                    <div class="text-center">
                        <i class="fas fa-spinner fa-spin text-2xl text-blue-500"></i>
                        <p class="text-sm text-gray-600 mt-2">Loading...</p>
                    </div>
                </div>
            </div>

            
        </div>
        </div>
        
       
        <script>
            // Load system status
            fetch('/health')
                .then(response => response.json())
                .then(data => {
                    const statusContainer = document.getElementById('system-status');
                    const services = data.services;
                    
                    statusContainer.innerHTML = Object.entries(services).map(([service, status]) => {
                        const isHealthy = status === 'ready' || status === 'connected' || status === 'configured';
                        const icon = isHealthy ? 'fas fa-check-circle text-green-500' : 'fas fa-exclamation-triangle text-yellow-500';
                        const statusText = isHealthy ? 'Healthy' : 'Issues';
                        
                        return \`
                            <div class="text-center">
                                <i class="\${icon} text-2xl"></i>
                                <p class="text-sm font-semibold mt-1">\${service.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase())}</p>
                                <p class="text-xs text-gray-500">\${statusText}</p>
                            </div>
                        \`;
                    }).join('');
                })
                .catch(error => {
                    document.getElementById('system-status').innerHTML = '<div class="col-span-full text-center text-red-500">Unable to load system status</div>';
                });
            
            // Page Navigation
            const navLinks = document.querySelectorAll('.nav-link');
            const pages = document.querySelectorAll('.page-container');
            
            navLinks.forEach(link => {
                link.addEventListener('click', (e) => {
                    e.preventDefault();
                    const targetPage = link.getAttribute('data-page');
                    
                    // Update active nav link
                    navLinks.forEach(l => l.classList.remove('active'));
                    link.classList.add('active');
                    
                    // Show target page
                    pages.forEach(page => {
                        page.classList.remove('active');
                        if (page.id === targetPage + 'Page') {
                            page.classList.add('active');
                        }
                    });
                });
            });
            
            // Language Switcher Functionality
            const translations = {
                en: {
                    'welcome-title': 'Welcome to HealthGrid Triage',
                    'welcome-subtitle': 'AI-Powered Healthcare Triage for Nigeria',
                    'chat-title': 'Live Chat with Doctor',
                    'online': 'Online',
                    'doctor-greeting': "Hello! I'm Dr. Sarah. How can I help you today?",
                    'patient-message': "I've been having chest pain for the past hour",
                    'chat-placeholder': 'Type your message...',
                    'quick-actions': 'Quick Actions',
                    'emergency': 'Emergency',
                    'book-appointment': 'Book Appointment',
                    'prescriptions': 'Prescriptions',
                    'health-records': 'Health Records',
                    'current-doctor': 'Current Doctor'
                },
                yo: {
                    'welcome-title': 'Kaabo si HealthGrid Triage',
                    'welcome-subtitle': 'AI-Powered Healthcare Triage fun Nigeria',
                    'chat-title': 'Soro pelu Dokita lori ayelujara',
                    'online': 'Lori ayelujara',
                    'doctor-greeting': 'Bawo! Emi ni Dokita Sarah. Bawo ni mo se le ran e lowo loni?',
                    'patient-message': 'Mo ti ni irora okan fun wakati kan seyhin',
                    'chat-placeholder': 'Ko ifiranise re...',
                    'quick-actions': 'Awon ise kiakia',
                    'emergency': 'Pajawiri',
                    'book-appointment': 'Ya adehun pade',
                    'prescriptions': 'Awon oogun',
                    'health-records': 'Awon igbasilẹ ilera',
                    'current-doctor': 'Dokita lọwọlọwọ'
                },
                ha: {
                    'welcome-title': 'Maraba da zuwa HealthGrid Triage',
                    'welcome-subtitle': 'AI-Powered Healthcare Triage don Najeriya',
                    'chat-title': 'Hira da Likita kai tsaye',
                    'online': 'A kan layi',
                    'doctor-greeting': 'Sannu! Ni ne Dokta Sarah. Ta yaya zan iya taimaka muku yau?',
                    'patient-message': 'Na samu ciwon kirji tsawon awa daya da suka wuce',
                    'chat-placeholder': 'Rubuta sakonku...',
                    'quick-actions': 'Ayyuka masu sauri',
                    'emergency': 'Gaggawa',
                    'book-appointment': 'Yi alƙawarin ganawar',
                    'prescriptions': 'Magunguna',
                    'health-records': 'Bayanan lafiya',
                    'current-doctor': 'Likita na yanzu'
                },
                ig: {
                    'welcome-title': 'Nnọọ na HealthGrid Triage',
                    'welcome-subtitle': 'AI-Powered Healthcare Triage maka Naịjirịa',
                    'chat-title': 'Kparịta ụka na Dọkịta ozugbo',
                    'online': 'Na ntanetị',
                    'doctor-greeting': 'Ndewo! Abụ m Dọkịta Sarah. Kedu ka m ga-esi nyere gị aka taa?',
                    'patient-message': 'Anọ m na-enwe mgbu obi kemgbe otu awa gara aga',
                    'chat-placeholder': 'Dee ozi gị...',
                    'quick-actions': 'Omume ngwa ngwa',
                    'emergency': 'Ihe mberede',
                    'book-appointment': 'Debe nhazi nzuko',
                    'prescriptions': 'Ọgwụ ndị e dere',
                    'health-records': 'Ndekọ ahụike',
                    'current-doctor': 'Dọkịta ugbu a'
                },
                pidgin: {
                    'welcome-title': 'Welcome to HealthGrid Triage',
                    'welcome-subtitle': 'AI-Powered Healthcare Triage for Nigeria',
                    'chat-title': 'Talk with Doctor for real time',
                    'online': 'Dey online',
                    'doctor-greeting': 'How far! Na Doctor Sarah be dis. How I fit help you today?',
                    'patient-message': 'I don dey get chest pain for like one hour now',
                    'chat-placeholder': 'Type your message...',
                    'quick-actions': 'Quick Actions',
                    'emergency': 'Emergency',
                    'book-appointment': 'Book Appointment',
                    'prescriptions': 'Medicine wey dem write',
                    'health-records': 'Health Records',
                    'current-doctor': 'Doctor wey dey attend to you now'
                }
            };
            
            let currentLanguage = 'en';
            
            function translatePage(lang) {
                currentLanguage = lang;
                const elements = document.querySelectorAll('[data-translate]');
                elements.forEach(element => {
                    const key = element.getAttribute('data-translate');
                    if (translations[lang] && translations[lang][key]) {
                        element.textContent = translations[lang][key];
                    }
                });
                
                // Update placeholders
                const placeholderElements = document.querySelectorAll('[data-translate-placeholder]');
                placeholderElements.forEach(element => {
                    const key = element.getAttribute('data-translate-placeholder');
                    if (translations[lang] && translations[lang][key]) {
                        element.placeholder = translations[lang][key];
                    }
                });
                
                // Update language selector
                document.getElementById('currentLang').textContent = lang.toUpperCase();
            }
            
            // Enhanced Language Switcher Event Listeners for Pills
            const languageLabels = {
                en: '🇺🇸 English',
                yo: '🇳🇬 Yoruba', 
                ha: '🇳🇬 Hausa',
                ig: '🇳🇬 Igbo',
                pidgin: '🇳🇬 Pidgin'
            };
            
            // Language pill selection
            document.querySelectorAll('.language-pill').forEach(pill => {
                pill.addEventListener('click', function(e) {
                    e.preventDefault();
                    const lang = this.getAttribute('data-lang');
                    translatePage(lang);
                    
                    // Update active state for pills
                    document.querySelectorAll('.language-pill').forEach(p => {
                        p.classList.remove('bg-blue-600', 'text-white');
                        p.classList.add('bg-gray-200', 'text-gray-700');
                    });
                    this.classList.remove('bg-gray-200', 'text-gray-700');
                    this.classList.add('bg-blue-600', 'text-white');
                });
            });
            
            // Chat functionality with backend integration
            const chatInput = document.getElementById('chatInput');
            const sendButton = document.getElementById('sendMessage');
            const chatMessages = document.getElementById('chatMessages');
            
            let currentSessionId = null;
            let lastMessageTime = new Date(0).toISOString(); // Start from epoch to get all messages initially
            let pollingInterval = null;
            let displayedMessageIds = new Set(); // Track displayed messages to prevent duplicates
            
            // Initialize chat session
            async function initializeChat() {
                try {
                    const response = await fetch('/api/chat/sessions', {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                        },
                        body: JSON.stringify({
                            session_type: 'triage',
                            language: currentLanguage,
                            priority: 'medium'
                        }),
                    });
                    
                    const result = await response.json();
                    if (result.success) {
                        currentSessionId = result.data.sessionId;
                        console.log('Chat session initialized:', currentSessionId);
                        
                        // Clear displayed message tracking for new session
                        displayedMessageIds.clear();
                        
                        // Load existing messages
                        await loadMessages();
                        
                        // Start polling for new messages
                        startPolling();
                    }
                } catch (error) {
                    console.error('Failed to initialize chat:', error);
                }
            }
            
            // Load messages from backend
            async function loadMessages() {
                if (!currentSessionId) return;
                
                try {
                    const response = await fetch(\`/api/chat/sessions/\${currentSessionId}/messages\`);
                    const result = await response.json();
                    
                    if (result.success) {
                        // Clear existing messages except typing indicator
                        const typingIndicator = chatMessages.querySelector('.typing-indicator');
                        chatMessages.innerHTML = '';
                        
                        // Add messages and track their IDs
                        result.data.forEach(message => {
                            addMessage(message.message_text, message.sender_type === 'patient', message.doctor_name, message.created_at);
                            displayedMessageIds.add(message.id); // Track this message as displayed
                        });
                        
                        // Re-add typing indicator if it existed
                        if (typingIndicator) {
                            addTypingIndicator();
                        }
                    }
                } catch (error) {
                    console.error('Failed to load messages:', error);
                }
            }
            
            // Poll for new messages
            function startPolling() {
                if (pollingInterval) return;
                
                pollingInterval = setInterval(async () => {
                    if (!currentSessionId) return;
                    
                    try {
                        const response = await fetch(\`/api/chat/sessions/\${currentSessionId}/messages/recent?since=\${encodeURIComponent(lastMessageTime)}\`);
                        const result = await response.json();
                        
                        if (result.success && result.data.length > 0) {
                            // Filter out messages that have already been displayed
                            const newMessages = result.data.filter(message => !displayedMessageIds.has(message.id));
                            
                            if (newMessages.length > 0) {
                                // Remove typing indicator when new messages arrive
                                const typingIndicator = chatMessages.querySelector('.typing-indicator');
                                if (typingIndicator) {
                                    typingIndicator.closest('.flex').remove();
                                }
                            }
                            
                            newMessages.forEach(message => {
                                addMessage(message.message_text, message.sender_type === 'patient', message.doctor_name, message.created_at);
                                displayedMessageIds.add(message.id); // Track this message as displayed
                            });
                            
                            // Update lastMessageTime to the timestamp of the most recent message
                            if (newMessages.length > 0) {
                                const latestMessage = result.data[result.data.length - 1];
                                lastMessageTime = latestMessage.created_at;
                            }
                        }
                    } catch (error) {
                        console.error('Failed to poll messages:', error);
                    }
                }, 2000);
            }
            
            function addMessage(message, isUser = false, doctorName = null, timestamp = null) {
                const messageDiv = document.createElement('div');
                messageDiv.className = \`flex items-start space-x-3 \${isUser ? 'justify-end' : ''}\`;
                
                const avatarClass = isUser ? 'bg-green-500' : 'bg-blue-500';
                const iconClass = isUser ? 'fas fa-user' : 'fas fa-user-md';
                const messageClass = isUser ? 'bg-green-50 border border-green-200 rounded-lg p-3 max-w-xs' : 'bg-blue-50 border border-blue-200 rounded-lg p-3 max-w-xs';
                
                // Format timestamp
                let timeDisplay = 'Just now';
                if (timestamp) {
                    const messageTime = new Date(timestamp);
                    const now = new Date();
                    const diffMs = now.getTime() - messageTime.getTime();
                    const diffMins = Math.floor(diffMs / (1000 * 60));
                    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
                    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
                    
                    if (diffMins < 1) {
                        timeDisplay = 'Just now';
                    } else if (diffMins < 60) {
                        timeDisplay = \`\${diffMins}m ago\`;
                    } else if (diffHours < 24) {
                        timeDisplay = \`\${diffHours}h ago\`;
                    } else if (diffDays < 7) {
                        timeDisplay = \`\${diffDays}d ago\`;
                    } else {
                        timeDisplay = messageTime.toLocaleDateString();
                    }
                }
                
                messageDiv.innerHTML = \`
                    \${!isUser ? \`<div class="w-8 h-8 \${avatarClass} rounded-full flex items-center justify-center">
                        <i class="\${iconClass} text-white text-xs"></i>
                    </div>\` : ''}
                    <div class="\${messageClass}">
                        \${!isUser && doctorName ? \`<p class="text-blue-600 text-xs font-semibold mb-1">\${doctorName}</p>\` : ''}
                        <p class="text-gray-800 text-sm">\${message}</p>
                        <span class="text-gray-500 text-xs">\${timeDisplay}</span>
                    </div>
                    \${isUser ? \`<div class="w-8 h-8 \${avatarClass} rounded-full flex items-center justify-center">
                        <i class="\${iconClass} text-white text-xs"></i>
                    </div>\` : ''}
                \`;
                
                // Remove typing indicator if exists
                const typingIndicator = chatMessages.querySelector('.typing-indicator');
                if (typingIndicator) {
                    typingIndicator.closest('.flex').remove();
                }
                
                chatMessages.appendChild(messageDiv);
                chatMessages.scrollTop = chatMessages.scrollHeight;
            }
            
            function addTypingIndicator() {
                const typingDiv = document.createElement('div');
                typingDiv.className = 'flex items-start space-x-3';
                typingDiv.innerHTML = \`
                    <div class="w-8 h-8 bg-blue-500 rounded-full flex items-center justify-center">
                        <i class="fas fa-user-md text-white text-xs"></i>
                    </div>
                    <div class="bg-gray-100 border border-gray-200 rounded-lg p-3">
                        <div class="typing-indicator">
                            <div class="typing-dot"></div>
                            <div class="typing-dot mx-1"></div>
                            <div class="typing-dot"></div>
                        </div>
                    </div>
                \`;
                chatMessages.appendChild(typingDiv);
                chatMessages.scrollTop = chatMessages.scrollHeight;
            }
            
            async function sendMessage() {
                const message = chatInput.value.trim();
                if (!message || !currentSessionId) return;
                
                try {
                    // Add typing indicator
                    addTypingIndicator();
                    
                    // Send to AI chat endpoint
                    const response = await fetch(\`/api/chat/sessions/\${currentSessionId}/ai-chat\`, {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                        },
                        body: JSON.stringify({
                            message: message
                        }),
                    });
                    
                    const result = await response.json();
                    if (result.success) {
                        // Add patient message to UI and track its ID
                        addMessage(message, true);
                        if (result.patientMessageId) {
                            displayedMessageIds.add(result.patientMessageId);
                        }
                        
                        // The AI response will be added via polling automatically
                        
                        // Show payment link if doctor referral is suggested
                        if (result.needsDoctor && result.paymentLink) {
                            showPaymentModal(result.paymentLink, result.detectedLanguage);
                        }
                        
                        chatInput.value = '';
                    } else {
                        console.error('Failed to send message:', result.error);
                        // Remove typing indicator on error
                        const typingIndicator = chatMessages.querySelector('.typing-indicator');
                        if (typingIndicator) {
                            typingIndicator.closest('.flex').remove();
                        }
                    }
                } catch (error) {
                    console.error('Failed to send message:', error);
                    // Remove typing indicator on error
                    const typingIndicator = chatMessages.querySelector('.typing-indicator');
                    if (typingIndicator) {
                        typingIndicator.closest('.flex').remove();
                    }
                }
            }
            
            // Function to show payment modal for doctor consultation
            function showPaymentModal(paymentLink, language) {
                const modal = document.createElement('div');
                modal.className = 'fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50';
                
                const messages = {
                    pidgin: {
                        title: 'Connect to Doctor',
                        message: 'You fit pay ₦15,000 to talk to our doctor online. You wan continue?',
                        payButton: 'Pay Now',
                        cancelButton: 'Cancel',
                        nameLabel: 'Your Name',
                        emailLabel: 'Your Email',
                        phoneLabel: 'Your Phone'
                    },
                    yoruba: {
                        title: 'Sopọ si Dokita',
                        message: 'O le san ₦15,000 lati ba dokita wa sọrọ lori ayelujara. Ṣe o fẹ tẹsiwaju?',
                        payButton: 'San Bayi',
                        cancelButton: 'Fagilee',
                        nameLabel: 'Orukọ Rẹ',
                        emailLabel: 'Imeeli Rẹ',
                        phoneLabel: 'Foonu Rẹ'
                    },
                    igbo: {
                        title: 'Jikọọ na Dọkịta',
                        message: "Ị nwere ike ịkwụ ₦15,000 iji gwa dọkịta anyị okwu na ịntanetị. Ị chọrọ ịga n'ihu?",
                        payButton: 'Kwụọ Ugbu a',
                        cancelButton: 'Kagbuo',
                        nameLabel: 'Aha Gị',
                        emailLabel: 'Email Gị',
                        phoneLabel: 'Ekwentị Gị'
                    },
                    hausa: {
                        title: 'Haɗu da Likita',
                        message: 'Kuna iya biyan ₦15,000 don yin hira da likitanmu a yanar gizo. Kuna son ci gaba?',
                        payButton: 'Biya Yanzu',
                        cancelButton: 'Soke',
                        nameLabel: 'Sunanku',
                        emailLabel: 'Imel ɗinku',
                        phoneLabel: 'Wayarku'
                    },
                    english: {
                        title: 'Connect to Doctor',
                        message: 'You can pay ₦15,000 to chat with our doctor online. Do you want to continue?',
                        payButton: 'Pay Now',
                        cancelButton: 'Cancel',
                        nameLabel: 'Your Name',
                        emailLabel: 'Your Email',
                        phoneLabel: 'Your Phone'
                    }
                };
                
                const msg = messages[language] || messages.english;
                
                modal.innerHTML = \`<div class="bg-white rounded-lg p-6 max-w-md mx-4"><h3 class="text-lg font-bold text-gray-800 mb-4">\${msg.title}</h3><p class="text-gray-600 mb-6">\${msg.message}</p><form id="paymentForm" class="space-y-4"><div><label class="block text-sm font-medium text-gray-700 mb-1">\${msg.nameLabel}</label><input type="text" id="customerName" required class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" placeholder="Enter your full name"></div><div><label class="block text-sm font-medium text-gray-700 mb-1">\${msg.emailLabel}</label><input type="email" id="customerEmail" required class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" placeholder="Enter your email"></div><div><label class="block text-sm font-medium text-gray-700 mb-1">\${msg.phoneLabel}</label><input type="tel" id="customerPhone" required class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" placeholder="Enter your phone number"></div><div class="flex space-x-3 mt-6"><button type="submit" id="payNowBtn" class="flex-1 bg-blue-500 hover:bg-blue-600 text-white py-2 px-4 rounded-lg transition-colors disabled:opacity-50">\${msg.payButton}</button><button type="button" id="cancelPayBtn" class="flex-1 bg-gray-300 hover:bg-gray-400 text-gray-800 py-2 px-4 rounded-lg transition-colors">\${msg.cancelButton}</button></div></form></div>\`;
                
                document.body.appendChild(modal);
                
                // Handle form submission
                modal.querySelector('#paymentForm').addEventListener('submit', async (e) => {
                    e.preventDefault();
                    
                    const name = modal.querySelector('#customerName').value.trim();
                    const email = modal.querySelector('#customerEmail').value.trim();
                    const phone = modal.querySelector('#customerPhone').value.trim();
                    
                    if (!name || !email || !phone) {
                        alert('Please fill in all fields');
                        return;
                    }
                    
                    const payButton = modal.querySelector('#payNowBtn');
                    payButton.disabled = true;
                    payButton.textContent = 'Processing...';
                    
                    try {
                        const response = await fetch('/api/payment/create', {
                            method: 'POST',
                            headers: {
                                'Content-Type': 'application/json'
                            },
                            body: JSON.stringify({
                                name,
                                email,
                                phone,
                                sessionId: sessionId || 'web-session-' + Date.now()
                            })
                        });
                        
                        const result = await response.json();
                        
                        if (result.success && result.paymentLink) {
                            window.open(result.paymentLink, '_blank');
                            document.body.removeChild(modal);
                        } else {
                            alert('Failed to create payment link: ' + (result.error || 'Unknown error'));
                            payButton.disabled = false;
                            payButton.textContent = msg.payButton;
                        }
                    } catch (error) {
                        console.error('Payment creation error:', error);
                        alert('Failed to create payment link. Please try again.');
                        payButton.disabled = false;
                        payButton.textContent = msg.payButton;
                    }
                });
                
                // Handle cancel button click
                modal.querySelector('#cancelPayBtn').addEventListener('click', () => {
                    document.body.removeChild(modal);
                });
                
                // Handle click outside modal
                modal.addEventListener('click', (e) => {
                    if (e.target === modal) {
                        document.body.removeChild(modal);
                    }
                });
            }
            
            // Initialize chat when page loads
            initializeChat();
            
            if (sendButton) {
                // Remove any existing event listeners to prevent duplicates
                sendButton.removeEventListener('click', sendMessage);
                sendButton.addEventListener('click', sendMessage);
            }
            if (chatInput) {
                // Remove any existing event listeners to prevent duplicates
                chatInput.removeEventListener('keypress', handleKeyPress);
                chatInput.addEventListener('keypress', handleKeyPress);
            }
            
            function handleKeyPress(e) {
                if (e.key === 'Enter') {
                    sendMessage();
                }
            }
            
            // Voice and video call buttons
            const voiceCallBtn = document.getElementById('voiceCall');
            const videoCallBtn = document.getElementById('videoCall');
            
            if (voiceCallBtn) {
                voiceCallBtn.addEventListener('click', () => {
                    alert(currentLanguage === 'en' ? 'Voice call feature coming soon!' : 
                          currentLanguage === 'yo' ? 'Ẹya ipe ohun n bọ laipẹ!' :
                          currentLanguage === 'ha' ? 'Fasalin kiran murya yana zuwa nan ba da jimawa ba!' :
                          currentLanguage === 'ig' ? 'Njirimara oku olu na-abịa noge na-adịghị anya!' :
                          'Voice call feature dey come soon!');
                });
            }
            
            if (videoCallBtn) {
                videoCallBtn.addEventListener('click', () => {
                    alert(currentLanguage === 'en' ? 'Video call feature coming soon!' : 
                          currentLanguage === 'yo' ? 'Ẹya ipe fidio n bọ laipẹ!' :
                          currentLanguage === 'ha' ? 'Fasalin kiran bidiyo yana zuwa nan ba da jimawa ba!' :
                          currentLanguage === 'ig' ? 'Njirimara oku vidiyo na-abịa noge na-adịghị anya!' :
                          'Video call feature dey come soon!');
                });
            }
            
            // Quick Action buttons
            const emergencyBtn = document.getElementById('emergencyBtn');
            const appointmentBtn = document.getElementById('appointmentBtn');
            const prescriptionsBtn = document.getElementById('prescriptionsBtn');
            const healthRecordsBtn = document.getElementById('healthRecordsBtn');
            
            if (emergencyBtn) {
                emergencyBtn.addEventListener('click', () => handleQuickAction('emergency'));
            }
            if (appointmentBtn) {
                appointmentBtn.addEventListener('click', () => handleQuickAction('appointment'));
            }
            if (prescriptionsBtn) {
                prescriptionsBtn.addEventListener('click', () => handleQuickAction('prescriptions'));
            }
            if (healthRecordsBtn) {
                healthRecordsBtn.addEventListener('click', () => handleQuickAction('health-records'));
            }
            
            async function handleQuickAction(actionType) {
                if (!currentSessionId) {
                    console.error('No active session');
                    return;
                }
                
                try {
                    const response = await fetch('/api/chat/sessions/' + currentSessionId + '/quick-action', {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                        },
                        body: JSON.stringify({
                            actionType: actionType
                        }),
                    });
                    
                    const result = await response.json();
                    if (result.success) {
                        // Messages will be displayed through polling
                        console.log('Quick action processed successfully');
                    } else {
                        console.error('Failed to process quick action:', result.error);
                    }
                } catch (error) {
                    console.error('Error processing quick action:', error);
                }
            }
        </script>
    </body>
    </html>
  `)
})

export default app