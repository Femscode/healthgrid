import { config } from 'dotenv';

if (process.env.NODE_ENV !== 'production') {
    config();
}

export interface FlutterwavePaymentData {
    tx_ref: string;
    amount: number;
    currency: string;
    redirect_url: string;
    customer: {
        email: string;
        phonenumber: string;
        name: string;
    };
    customizations: {
        title: string;
        description: string;
        logo: string;
    };
}

export interface FlutterwaveResponse {
    status: string;
    message: string;
    data: {
        link: string;
    };
}

export class FlutterwaveService {
    private publicKey: string;
    private secretKey: string;
    private baseUrl: string;

    constructor() {
        this.publicKey = process.env.FLUTTERWAVE_PUBLIC_KEY || '';
        this.secretKey = process.env.FLUTTERWAVE_SECRET_KEY || '';
        this.baseUrl = 'https://api.flutterwave.com/v3';
        
        if (!this.publicKey || !this.secretKey) {
            console.warn('Flutterwave keys not configured. Payment functionality will be limited.');
        }
    }

    /**
     * Create a payment link for doctor consultation
     */
    async createPaymentLink(customerData: {
        email: string;
        phone: string;
        name: string;
        sessionId: string;
    }): Promise<string> {
        try {
            const paymentData: FlutterwavePaymentData = {
                tx_ref: `consultation_${customerData.sessionId}_${Date.now()}`,
                amount: 15000, // ₦15,000
                currency: 'NGN',
                redirect_url: `${process.env.BASE_URL || 'http://localhost:5173'}/payment/callback`,
                customer: {
                    email: customerData.email,
                    phonenumber: customerData.phone,
                    name: customerData.name
                },
                customizations: {
                    title: 'HealthGrid Doctor Consultation',
                    description: 'Online consultation with certified doctor',
                    logo: `${process.env.BASE_URL || 'http://localhost:5173'}/logo.png`
                }
            };

            const response = await fetch(`${this.baseUrl}/payments`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${this.secretKey}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(paymentData)
            });

            const result: FlutterwaveResponse = await response.json();

            if (result.status === 'success') {
                return result.data.link;
            } else {
                throw new Error(result.message || 'Failed to create payment link');
            }
        } catch (error) {
            console.error('Error creating Flutterwave payment link:', error);
            throw error;
        }
    }

    /**
     * Verify payment transaction
     */
    async verifyTransaction(transactionId: string): Promise<boolean> {
        try {
            const response = await fetch(`${this.baseUrl}/transactions/${transactionId}/verify`, {
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${this.secretKey}`,
                    'Content-Type': 'application/json'
                }
            });

            const result = await response.json();

            return result.status === 'success' && 
                   result.data.status === 'successful' && 
                   result.data.amount >= 15000;
        } catch (error) {
            console.error('Error verifying Flutterwave transaction:', error);
            return false;
        }
    }

    /**
     * Handle payment callback
     */
    async handleCallback(transactionId: string, txRef: string): Promise<{
        success: boolean;
        sessionId?: string;
        message: string;
    }> {
        try {
            const isVerified = await this.verifyTransaction(transactionId);
            
            if (isVerified) {
                // Extract session ID from tx_ref
                const sessionIdMatch = txRef.match(/consultation_(.+?)_\d+/);
                const sessionId = sessionIdMatch ? sessionIdMatch[1] : undefined;
                
                return {
                    success: true,
                    sessionId,
                    message: 'Payment verified successfully'
                };
            } else {
                return {
                    success: false,
                    message: 'Payment verification failed'
                };
            }
        } catch (error) {
            console.error('Error handling payment callback:', error);
            return {
                success: false,
                message: 'Error processing payment callback'
            };
        }
    }

    /**
     * Get public key for frontend integration
     */
    getPublicKey(): string {
        return this.publicKey;
    }
}