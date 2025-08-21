/**
 * HealthGrid AI Triage Server - Hono Implementation
 * Complete healthcare triage system with Gupshup WhatsApp integration
 * Handles medical triage conversations through WhatsApp Business API
 */
import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { logger } from 'hono/logger'
import { serveStatic } from 'hono/cloudflare-workers'

// Import healthcare services
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

// Types for Cloudflare bindings
type Bindings = {
  DB?: D1Database;
  KV?: KVNamespace;
  R2?: R2Bucket;
  GUPSHUP_API_KEY?: string;
  GUPSHUP_SOURCE_NUMBER?: string;
  MONGODB_URI?: string;
}

const app = new Hono<{ Bindings: Bindings }>()

// Global variables for services
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

// Middleware
app.use('*', logger())
app.use('/api/*', cors())
app.use('/static/*', serveStatic({ root: './public' }))

/**
 * Initialize all healthcare services
 */
async function initializeServices(env: Bindings) {
  try {
    console.log('Starting HealthGrid AI Triage Server...')
    
    // Validate environment variables
    if (!env.GUPSHUP_API_KEY || !env.GUPSHUP_SOURCE_NUMBER) {
      throw new Error('Missing required Gupshup configuration')
    }
    
    // Initialize session manager
    sessionManager = new SessionManager(env.DB)
    await sessionManager.init()
    
    // Initialize health record service
    healthRecordService = new HealthRecordService(env.DB)
    
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
    gupshupService = new GupshupService(env.GUPSHUP_API_KEY, env.GUPSHUP_SOURCE_NUMBER)
    
    // Initialize webhook handler
    webhookHandler = new WebhookHandler(sessionManager, conversationManager, gupshupService)
    
    console.log('All healthcare services initialized successfully')
    
  } catch (error) {
    console.error('Service initialization failed:', error)
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
    
  } catch (error) {
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
    
  } catch (error) {
    console.error('Health check failed:', error)
    return c.json({
      status: 'unhealthy',
      error: error.message,
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
  } catch (error) {
    return c.json({ error: error.message }, 400)
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
  } catch (error) {
    return c.json({ error: error.message }, 400)
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
  } catch (error) {
    return c.json({ error: error.message }, 400)
  }
})

// HMO enrollment verification
app.post('/api/hmo/verify', async (c) => {
  try {
    const { membershipInfo } = await c.req.json()
    const session = {} as any // Get session context
    
    const enrollment = await hmoService.verifyHMOEnrollment(membershipInfo, session)
    
    return c.json({ success: true, enrollment })
  } catch (error) {
    return c.json({ error: error.message }, 400)
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
  } catch (error) {
    return c.json({ error: error.message }, 400)
  }
})

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
    </head>
    <body class="bg-gradient-to-br from-green-50 to-blue-50 min-h-screen">
        <div class="container mx-auto px-4 py-8">
            <!-- Header -->
            <div class="text-center mb-12">
                <div class="flex items-center justify-center mb-4">
                    <i class="fas fa-heartbeat text-5xl text-green-600 mr-4"></i>
                    <h1 class="text-4xl font-bold text-gray-800">HealthGrid</h1>
                </div>
                <p class="text-xl text-gray-600">AI-Powered Healthcare Triage System</p>
                <p class="text-lg text-gray-500 mt-2">Complete Healthcare Ecosystem for Nigeria</p>
            </div>

            <!-- Six Core Features -->
            <div class="grid md:grid-cols-2 lg:grid-cols-3 gap-8 mb-12">
                <!-- WhatsApp AI Triage -->
                <div class="bg-white rounded-lg shadow-lg p-6 hover:shadow-xl transition-shadow">
                    <div class="flex items-center mb-4">
                        <i class="fab fa-whatsapp text-3xl text-green-500 mr-3"></i>
                        <h3 class="text-xl font-bold">WhatsApp AI Triage</h3>
                    </div>
                    <p class="text-gray-600">Intelligent symptom assessment in 5 Nigerian languages with emergency detection</p>
                    <div class="mt-4 space-y-2">
                        <div class="flex items-center text-sm text-gray-500">
                            <i class="fas fa-language mr-2"></i>
                            English, Pidgin, Yoruba, Hausa, Igbo
                        </div>
                        <div class="flex items-center text-sm text-gray-500">
                            <i class="fas fa-bolt mr-2"></i>
                            Real-time emergency detection
                        </div>
                    </div>
                </div>

                <!-- Telemedicine -->
                <div class="bg-white rounded-lg shadow-lg p-6 hover:shadow-xl transition-shadow">
                    <div class="flex items-center mb-4">
                        <i class="fas fa-video text-3xl text-blue-500 mr-3"></i>
                        <h3 class="text-xl font-bold">Telemedicine</h3>
                    </div>
                    <p class="text-gray-600">Seamless video consultations with qualified healthcare providers</p>
                    <div class="mt-4 space-y-2">
                        <div class="flex items-center text-sm text-gray-500">
                            <i class="fas fa-camera mr-2"></i>
                            HD video consultations
                        </div>
                        <div class="flex items-center text-sm text-gray-500">
                            <i class="fas fa-phone mr-2"></i>
                            Audio-only fallback
                        </div>
                    </div>
                </div>

                <!-- Digital Prescriptions -->
                <div class="bg-white rounded-lg shadow-lg p-6 hover:shadow-xl transition-shadow">
                    <div class="flex items-center mb-4">
                        <i class="fas fa-pills text-3xl text-purple-500 mr-3"></i>
                        <h3 class="text-xl font-bold">Digital Prescriptions</h3>
                    </div>
                    <p class="text-gray-600">Secure prescription management with pharmacy integration and delivery</p>
                    <div class="mt-4 space-y-2">
                        <div class="flex items-center text-sm text-gray-500">
                            <i class="fas fa-qrcode mr-2"></i>
                            QR code verification
                        </div>
                        <div class="flex items-center text-sm text-gray-500">
                            <i class="fas fa-truck mr-2"></i>
                            Home delivery
                        </div>
                    </div>
                </div>

                <!-- Health Records -->
                <div class="bg-white rounded-lg shadow-lg p-6 hover:shadow-xl transition-shadow">
                    <div class="flex items-center mb-4">
                        <i class="fas fa-file-medical-alt text-3xl text-indigo-500 mr-3"></i>
                        <h3 class="text-xl font-bold">Health Records</h3>
                    </div>
                    <p class="text-gray-600">Comprehensive FHIR-compliant health records for continuity of care</p>
                    <div class="mt-4 space-y-2">
                        <div class="flex items-center text-sm text-gray-500">
                            <i class="fas fa-shield-alt mr-2"></i>
                            FHIR compliant
                        </div>
                        <div class="flex items-center text-sm text-gray-500">
                            <i class="fas fa-history mr-2"></i>
                            Longitudinal tracking
                        </div>
                    </div>
                </div>

                <!-- Insurance & HMO -->
                <div class="bg-white rounded-lg shadow-lg p-6 hover:shadow-xl transition-shadow">
                    <div class="flex items-center mb-4">
                        <i class="fas fa-umbrella text-3xl text-orange-500 mr-3"></i>
                        <h3 class="text-xl font-bold">Insurance & HMO</h3>
                    </div>
                    <p class="text-gray-600">Seamless integration with NHIS and major Nigerian HMO providers</p>
                    <div class="mt-4 space-y-2">
                        <div class="flex items-center text-sm text-gray-500">
                            <i class="fas fa-check-circle mr-2"></i>
                            NHIS integration
                        </div>
                        <div class="flex items-center text-sm text-gray-500">
                            <i class="fas fa-network-wired mr-2"></i>
                            HMO networks
                        </div>
                    </div>
                </div>

                <!-- Lab Integration -->
                <div class="bg-white rounded-lg shadow-lg p-6 hover:shadow-xl transition-shadow">
                    <div class="flex items-center mb-4">
                        <i class="fas fa-microscope text-3xl text-red-500 mr-3"></i>
                        <h3 class="text-xl font-bold">Lab Integration</h3>
                    </div>
                    <p class="text-gray-600">Seamless diagnostic test ordering and results management</p>
                    <div class="mt-4 space-y-2">
                        <div class="flex items-center text-sm text-gray-500">
                            <i class="fas fa-vial mr-2"></i>
                            Test ordering
                        </div>
                        <div class="flex items-center text-sm text-gray-500">
                            <i class="fas fa-chart-line mr-2"></i>
                            Results tracking
                        </div>
                    </div>
                </div>
            </div>

            <!-- System Status -->
            <div class="bg-white rounded-lg shadow-lg p-6 mb-8">
                <h3 class="text-xl font-bold mb-4 flex items-center">
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

            <!-- Quick Actions -->
            <div class="text-center">
                <h3 class="text-xl font-bold mb-6">Get Started</h3>
                <div class="space-y-4 md:space-y-0 md:space-x-4 md:flex md:justify-center">
                    <a href="https://wa.me/YOUR_WHATSAPP_NUMBER" class="inline-block bg-green-500 hover:bg-green-600 text-white px-6 py-3 rounded-lg font-semibold transition-colors">
                        <i class="fab fa-whatsapp mr-2"></i>
                        Start WhatsApp Triage
                    </a>
                    <a href="/health" class="inline-block bg-blue-500 hover:bg-blue-600 text-white px-6 py-3 rounded-lg font-semibold transition-colors">
                        <i class="fas fa-chart-pie mr-2"></i>
                        System Health
                    </a>
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
        </script>
    </body>
    </html>
  `)
})

export default app