/**
 * Prescription Management Service
 * Handles digital prescriptions, pharmacy integration, and medication delivery
 */
export class PrescriptionService {
  private healthRecordService: any
  private insuranceService: any
  private prescriptionStates: Record<string, string>
  private pharmacyPartners: Map<string, any>

  constructor(healthRecordService: any, insuranceService: any) {
    this.healthRecordService = healthRecordService
    this.insuranceService = insuranceService
    
    this.prescriptionStates = {
      ISSUED: 'issued',
      VERIFIED: 'verified',
      DISPENSED: 'dispensed',
      DELIVERED: 'delivered',
      COMPLETED: 'completed',
      CANCELLED: 'cancelled'
    }

    // Initialize mock pharmacy partners
    this.pharmacyPartners = this.initializePharmacyNetwork()
  }

  async createPrescription(consultationId: string, prescriptionData: any, session: any): Promise<any> {
    try {
      console.log('Creating prescription', {
        consultationId,
        patientPhone: session.phoneNumber,
        medicationCount: prescriptionData.medications?.length || 0
      })

      // Generate secure prescription ID
      const prescriptionId = this.generatePrescriptionId()
      
      // Mock validation - in real implementation, this would be comprehensive
      const validationResult = { isValid: true, errors: [] }
      if (!prescriptionData.medications || prescriptionData.medications.length === 0) {
        validationResult.isValid = false
        validationResult.errors.push('No medications specified')
      }

      if (!validationResult.isValid) {
        throw new Error(`Prescription validation failed: ${validationResult.errors.join(', ')}`)
      }

      // Process medications
      const processedMedications = prescriptionData.medications.map((med: any) => ({
        ...med,
        id: this.generateMedicationId(),
        unitCost: med.unitCost || 500, // Default NGN 500 per unit
        quantity: med.quantity || 30,
        totalCost: (med.unitCost || 500) * (med.quantity || 30)
      }))

      // Create prescription record
      const prescription = {
        id: prescriptionId,
        consultationId,
        patientPhone: session.phoneNumber,
        patientId: session.patientId || `patient_${session.phoneNumber}`,
        providerId: prescriptionData.providerId,
        issuedAt: new Date(),
        status: this.prescriptionStates.ISSUED,
        medications: processedMedications,
        instructions: prescriptionData.instructions || 'Take as prescribed',
        language: session.preferredLanguage,
        digitalSignature: this.generateDigitalSignature(prescriptionData),
        expiryDate: this.calculateExpiryDate(30), // 30 days validity
        refillsAllowed: prescriptionData.refillsAllowed || 0
      }

      // Find nearby pharmacies
      const nearbyPharmacies = await this.findNearbyPharmacies(
        session.location, 
        prescription.medications
      )

      console.log('Prescription created successfully', {
        prescriptionId,
        patientPhone: session.phoneNumber,
        pharmacyCount: nearbyPharmacies.length
      })

      return {
        prescriptionId,
        pharmacies: nearbyPharmacies,
        estimatedCost: this.calculateTotalCost(processedMedications),
        qrCode: await this.generatePrescriptionQRCode(prescription)
      }

    } catch (error) {
      console.error('Failed to create prescription', {
        consultationId,
        error: error.message
      })
      throw new Error(`Prescription creation failed: ${error.message}`)
    }
  }

  async sendPrescriptionToPatient(prescription: any, pharmacies: any[], session: any): Promise<any> {
    try {
      // Format prescription message in patient's language
      const prescriptionMessage = this.formatPrescriptionMessage(prescription, session.preferredLanguage)
      
      // Create pharmacy selection interface
      const pharmacySections = [{
        title: "Select Pharmacy",
        rows: pharmacies.slice(0, 10).map(pharmacy => ({
          id: `pharmacy_${pharmacy.id}`,
          title: pharmacy.name,
          description: `${pharmacy.distance} • ${pharmacy.deliveryTime} • ₦${pharmacy.estimatedCost.toLocaleString()}`
        }))
      }]

      return {
        type: 'prescription_issued',
        message: prescriptionMessage,
        interactive: {
          type: 'list',
          buttonText: 'Select Pharmacy',
          sections: pharmacySections
        }
      }

    } catch (error) {
      console.error('Failed to send prescription to patient', {
        prescriptionId: prescription.id,
        error: error.message
      })
      throw error
    }
  }

  async handlePharmacySelection(prescriptionId: string, pharmacyId: string, session: any, gupshupService: any): Promise<any> {
    try {
      // Mock prescription and pharmacy data
      const prescription = {
        id: prescriptionId,
        medications: [
          { name: 'Paracetamol', dosage: '500mg', quantity: 20, unitCost: 50 },
          { name: 'Amoxicillin', dosage: '250mg', quantity: 21, unitCost: 75 }
        ]
      }

      const pharmacy = {
        id: pharmacyId,
        name: 'HealthPlus Pharmacy',
        location: 'Victoria Island, Lagos',
        deliveryFee: 500,
        estimatedDelivery: '2-3 hours'
      }

      // Calculate costs
      const medicationCost = this.calculateTotalCost(prescription.medications)
      const deliveryFee = pharmacy.deliveryFee
      const totalCost = medicationCost + deliveryFee

      // Create order
      const order = {
        id: this.generateOrderId(),
        prescriptionId,
        pharmacyId,
        patientPhone: session.phoneNumber,
        medicationCost,
        deliveryFee,
        totalCost,
        estimatedDelivery: pharmacy.estimatedDelivery
      }

      // Send order confirmation
      const confirmationMessage = this.formatOrderConfirmation(
        order, 
        pharmacy,
        prescription,
        session.preferredLanguage
      )

      // Offer payment options
      const paymentButtons = [
        { id: 'pay_card', title: '💳 Pay with Card' },
        { id: 'pay_transfer', title: '🏦 Bank Transfer' },
        { id: 'pay_ussd', title: '📱 USSD Code' }
      ]

      await gupshupService.sendInteractiveButtons(
        session.phoneNumber,
        confirmationMessage,
        paymentButtons
      )

      return {
        type: 'pharmacy_order_created',
        orderId: order.id,
        estimatedDelivery: order.estimatedDelivery,
        totalCost: order.totalCost
      }

    } catch (error) {
      console.error('Pharmacy selection failed', {
        prescriptionId,
        pharmacyId,
        error: error.message
      })
      throw error
    }
  }

  async processPayment(orderId: string, paymentMethod: string, session: any, gupshupService: any): Promise<any> {
    try {
      // Mock payment processing
      let paymentResult = { success: true, transactionId: this.generateTransactionId() }
      
      if (paymentResult.success) {
        const confirmationMessage = this.formatPaymentConfirmation(
          paymentResult,
          paymentMethod,
          session.preferredLanguage
        )
        
        await gupshupService.sendTextMessage(session.phoneNumber, confirmationMessage)
        
        // Start delivery tracking
        await this.startDeliveryTracking(orderId, session, gupshupService)
      }

      return paymentResult

    } catch (error) {
      console.error('Payment processing failed', {
        orderId,
        paymentMethod,
        error: error.message
      })
      throw error
    }
  }

  private async startDeliveryTracking(orderId: string, session: any, gupshupService: any): Promise<void> {
    // Mock delivery tracking with updates
    const deliveryStatuses = [
      { status: 'confirmed', message: 'Order confirmed - preparing your medications', delay: 5000 },
      { status: 'packed', message: 'Medications packed and ready for dispatch', delay: 15000 },
      { status: 'dispatched', message: 'Delivery partner has picked up your order', delay: 30000 },
      { status: 'out_for_delivery', message: 'Out for delivery - arriving soon!', delay: 45000 },
      { status: 'delivered', message: 'Delivered successfully! Please confirm receipt.', delay: 60000 }
    ]

    for (const update of deliveryStatuses) {
      setTimeout(async () => {
        const updateMessage = this.formatDeliveryUpdate(update, session.preferredLanguage)
        await gupshupService.sendTextMessage(session.phoneNumber, updateMessage)
        
        if (update.status === 'delivered') {
          await this.completePrescription(orderId, session)
        }
      }, update.delay)
    }
  }

  private async completePrescription(orderId: string, session: any): Promise<void> {
    try {
      console.log('Prescription completed successfully', {
        orderId,
        patientPhone: session.phoneNumber
      })

      // Update health records if available
      if (this.healthRecordService) {
        await this.healthRecordService.recordMedicationCompliance(
          session.patientId,
          orderId,
          'delivered_and_received'
        )
      }

    } catch (error) {
      console.error('Failed to complete prescription', {
        orderId,
        error: error.message
      })
    }
  }

  private formatPrescriptionMessage(prescription: any, language: string): string {
    const messages: Record<string, (p: any) => string> = {
      en: (p) => `💊 **New Prescription Issued**\n\n**Prescription ID:** ${p.id}\n**Date:** ${p.issuedAt.toLocaleDateString()}\n\n**Medications:**\n${p.medications.map((med: any, index: number) => 
        `${index + 1}. **${med.name}**\n   • Dosage: ${med.dosage}\n   • Quantity: ${med.quantity}\n   • Cost: ₦${med.totalCost.toLocaleString()}`
      ).join('\n\n')}\n\n**Instructions:** ${p.instructions}\n\n**Next Steps:**\n1. Select a pharmacy below\n2. Choose payment method\n3. Receive delivery updates\n\n⚠️ **Important:** Take medications exactly as prescribed.`,
      
      pcm: (p) => `💊 **New Medicine Prescription**\n\n**Prescription ID:** ${p.id}\n**Date:** ${p.issuedAt.toLocaleDateString()}\n\n**Medicine:**\n${p.medications.map((med: any, index: number) => 
        `${index + 1}. **${med.name}**\n   • How Much: ${med.dosage}\n   • How Many: ${med.quantity}\n   • Cost: ₦${med.totalCost.toLocaleString()}`
      ).join('\n\n')}\n\n**How to Take:** ${p.instructions}\n\n**Next Steps:**\n1. Pick pharmacy\n2. Pay\n3. Wait for delivery\n\n⚠️ **Important:** Take medicine exactly as doctor talk.`
    }

    const formatter = messages[language] || messages.en
    return formatter(prescription)
  }

  private formatOrderConfirmation(order: any, pharmacy: any, prescription: any, language: string): string {
    const messages: Record<string, string> = {
      en: `📋 **Order Confirmation**\n\n**Pharmacy:** ${pharmacy.name}\n**Location:** ${pharmacy.location}\n\n**Cost Breakdown:**\n• Medications: ₦${order.medicationCost.toLocaleString()}\n• Delivery: ₦${order.deliveryFee.toLocaleString()}\n• **Total: ₦${order.totalCost.toLocaleString()}**\n\n**Estimated Delivery:** ${order.estimatedDelivery}\n\nPlease select your payment method below.`,
      
      pcm: `📋 **Order Confirmation**\n\n**Pharmacy:** ${pharmacy.name}\n**Location:** ${pharmacy.location}\n\n**Money Breakdown:**\n• Medicine: ₦${order.medicationCost.toLocaleString()}\n• Delivery: ₦${order.deliveryFee.toLocaleString()}\n• **Total: ₦${order.totalCost.toLocaleString()}**\n\n**When E Go Reach:** ${order.estimatedDelivery}\n\nAbeg pick how you wan pay.`
    }

    return messages[language] || messages.en
  }

  private formatPaymentConfirmation(paymentResult: any, paymentMethod: string, language: string): string {
    const messages: Record<string, string> = {
      en: `✅ **Payment Successful**\n\n**Transaction ID:** ${paymentResult.transactionId}\n**Method:** ${paymentMethod}\n\nYour order is being prepared. You'll receive delivery updates shortly.\n\nThank you for choosing HealthGrid!`,
      
      pcm: `✅ **Payment Successful**\n\n**Transaction ID:** ${paymentResult.transactionId}\n**Method:** ${paymentMethod}\n\nDem dey prepare your order. You go get update soon.\n\nThanks for choosing HealthGrid!`
    }

    return messages[language] || messages.en
  }

  private formatDeliveryUpdate(update: any, language: string): string {
    const messages: Record<string, Record<string, string>> = {
      en: {
        confirmed: '✅ Order confirmed - preparing your medications',
        packed: '📦 Medications packed and ready for dispatch',
        dispatched: '🚛 Delivery partner has picked up your order',
        out_for_delivery: '🏃 Out for delivery - arriving soon!',
        delivered: '🎉 Delivered successfully! Please confirm receipt.'
      },
      pcm: {
        confirmed: '✅ Order confirm - dem dey prepare your medicine',
        packed: '📦 Medicine don pack ready for delivery',
        dispatched: '🚛 Delivery person don carry your order',
        out_for_delivery: '🏃 Dem dey come with your medicine!',
        delivered: '🎉 Medicine don reach! Abeg confirm say you collect am.'
      }
    }

    return messages[language]?.[update.status] || messages.en[update.status] || update.message
  }

  private async generatePrescriptionQRCode(prescription: any): Promise<any> {
    // Mock QR code generation
    return {
      dataUrl: `data:image/png;base64,iVBORw0KGgoAAAANSUhEUGAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/5+hHgAHggJ/PchI7wAAAABJRU5ErkJggg==`,
      data: {
        prescriptionId: prescription.id,
        patientPhone: prescription.patientPhone,
        issuedAt: prescription.issuedAt,
        checksum: 'mock_checksum_123'
      },
      verificationUrl: `https://verify.healthgrid.ng/prescription/${prescription.id}`
    }
  }

  private async findNearbyPharmacies(location: any, medications: any[]): Promise<any[]> {
    // Mock pharmacies
    return [
      {
        id: '1',
        name: 'HealthPlus Pharmacy',
        location: 'Victoria Island, Lagos',
        distance: '2.3km',
        deliveryTime: '2-3 hours',
        estimatedCost: 2500,
        hasStock: true
      },
      {
        id: '2',
        name: 'MedPlus Pharmacy',
        location: 'Ikeja, Lagos',
        distance: '4.1km',
        deliveryTime: '3-4 hours',
        estimatedCost: 2300,
        hasStock: true
      },
      {
        id: '3',
        name: 'Alfa Pharmacy',
        location: 'Surulere, Lagos',
        distance: '3.7km',
        deliveryTime: '2-3 hours',
        estimatedCost: 2400,
        hasStock: true
      }
    ]
  }

  private calculateTotalCost(medications: any[]): number {
    return medications.reduce((total, med) => total + (med.totalCost || med.unitCost * med.quantity), 0)
  }

  private initializePharmacyNetwork(): Map<string, any> {
    const partners = new Map()
    
    partners.set('healthplus', {
      name: 'HealthPlus Pharmacy',
      coverage: ['Lagos', 'Abuja', 'Port Harcourt'],
      deliveryService: true
    })
    
    partners.set('medplus', {
      name: 'MedPlus Pharmacy',
      coverage: ['Kano', 'Kaduna', 'Abuja'],
      deliveryService: true
    })

    return partners
  }

  private generatePrescriptionId(): string {
    return `RX_${Date.now()}_${Math.random().toString(36).substring(7).toUpperCase()}`
  }

  private generateMedicationId(): string {
    return `MED_${Date.now()}_${Math.random().toString(36).substring(7)}`
  }

  private generateOrderId(): string {
    return `ORD_${Date.now()}_${Math.random().toString(36).substring(7).toUpperCase()}`
  }

  private generateTransactionId(): string {
    return `TXN_${Date.now()}_${Math.random().toString(36).substring(7).toUpperCase()}`
  }

  private generateDigitalSignature(prescriptionData: any): string {
    return `SIG_${Date.now()}_${Math.random().toString(36).substring(7)}`
  }

  private calculateExpiryDate(days: number): Date {
    const expiry = new Date()
    expiry.setDate(expiry.getDate() + days)
    return expiry
  }
}