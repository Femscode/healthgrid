/**
 * Diagnostic Lab Referral and Integration Service
 * Seamlessly connects consultations to lab testing and results management
 */
export class DiagnosticLabService {
  private healthRecordService: any
  private insuranceService: any
  private hmoService: any
  private labNetworks: Map<string, any>
  private testCategories: Record<string, string>
  private testStates: Record<string, string>
  private testDatabase: Map<string, any>
  private activeTests: Map<string, any>

  constructor(healthRecordService: any, insuranceService: any, hmoService: any) {
    this.healthRecordService = healthRecordService
    this.insuranceService = insuranceService
    this.hmoService = hmoService
    
    this.labNetworks = this.initializeLabNetworks()
    
    this.testCategories = {
      BLOOD_CHEMISTRY: 'blood_chemistry',
      HEMATOLOGY: 'hematology', 
      MICROBIOLOGY: 'microbiology',
      PARASITOLOGY: 'parasitology',
      IMMUNOLOGY: 'immunology',
      RADIOLOGY: 'radiology'
    }
    
    this.testStates = {
      ORDERED: 'ordered',
      SAMPLE_COLLECTION_SCHEDULED: 'sample_collection_scheduled',
      SAMPLE_COLLECTED: 'sample_collected',
      PROCESSING: 'processing',
      RESULTS_READY: 'results_ready',
      RESULTS_DELIVERED: 'results_delivered',
      CANCELLED: 'cancelled'
    }

    this.testDatabase = this.initializeNigerianTestDatabase()
    this.activeTests = new Map()
  }

  async processLabReferral(consultationId: string, labOrders: any, session: any, providerInfo: any): Promise<any> {
    try {
      console.log('Processing lab referral from consultation', {
        consultationId,
        testCount: labOrders?.tests?.length || 0,
        patientPhone: session.phoneNumber
      })

      // Validate lab orders
      const validationResult = await this.validateLabOrders(labOrders, session)
      if (!validationResult.isValid) {
        throw new Error(`Lab order validation failed: ${validationResult.errors.join(', ')}`)
      }

      // Create lab referral record
      const labReferral = {
        id: this.generateLabReferralId(),
        consultationId,
        patientId: session.patientId || `patient_${session.phoneNumber}`,
        patientPhone: session.phoneNumber,
        providerId: providerInfo?.id || 'provider_demo',
        providerName: providerInfo?.name || 'Dr. Demo Provider',
        referralDate: new Date(),
        status: this.testStates.ORDERED,
        language: session.preferredLanguage,
        
        clinicalIndication: labOrders.clinicalIndication || 'Routine health check',
        symptoms: session.triageData?.symptoms || [],
        suspectedConditions: labOrders.suspectedConditions || [],
        urgencyLevel: labOrders.urgencyLevel || 'routine',
        
        tests: await this.processIndividualTests(labOrders.tests || []),
        preparationInstructions: await this.generatePreparationInstructions(labOrders.tests || [], session.preferredLanguage),
        
        createdAt: new Date()
      }

      // Store referral
      if (this.healthRecordService) {
        await this.healthRecordService.addLabReferralToRecord(session.patientId, labReferral)
      }

      // Find compatible labs
      const availableLabs = await this.findCompatibleLabs(labReferral, session)

      if (availableLabs.length === 0) {
        return await this.handleNoAvailableLabs(labReferral, session)
      }

      // Analyze coverage
      const coverageAnalysis = await this.analyzeCoverage(labReferral, session)

      // Track this referral
      this.activeTests.set(labReferral.id, {
        ...labReferral,
        availableLabs,
        coverageAnalysis,
        session
      })

      return {
        referralId: labReferral.id,
        testsOrdered: labReferral.tests.length,
        availableLabs: availableLabs.length,
        estimatedCost: coverageAnalysis.estimatedPatientCost,
        urgencyLevel: labReferral.urgencyLevel
      }

    } catch (error: any) {
      console.error('Lab referral processing failed', {
        consultationId,
        error: error.message
      })
      throw new Error(`Lab referral failed: ${error.message}`)
    }
  }

  async handleLabSelection(referralId: string, selectedLabId: string, preferredAppointmentTime: string, session: any, gupshupService: any): Promise<any> {
    try {
      const labReferral = this.activeTests.get(referralId)
      if (!labReferral) {
        throw new Error('Lab referral not found or expired')
      }

      const selectedLab = labReferral.availableLabs.find((lab: any) => lab.id === selectedLabId)
      if (!selectedLab) {
        throw new Error('Selected lab not available')
      }

      // Check test availability
      const availability = await this.checkTestAvailability(labReferral.tests, selectedLab)
      if (!availability.allTestsAvailable) {
        return await this.handlePartialTestAvailability(labReferral, selectedLab, availability, session, gupshupService)
      }

      // Calculate costs
      const finalCostBreakdown = await this.calculateFinalCosts(labReferral, selectedLab, labReferral.coverageAnalysis)

      // Create appointment
      const appointment = await this.createLabAppointment({
        referralId,
        labId: selectedLabId,
        patientPhone: session.phoneNumber,
        tests: labReferral.tests,
        preferredTime: preferredAppointmentTime,
        costBreakdown: finalCostBreakdown,
        preparationInstructions: labReferral.preparationInstructions
      })

      // Send confirmation
      const confirmationMessage = await this.formatAppointmentConfirmation(
        appointment,
        selectedLab,
        finalCostBreakdown,
        session.preferredLanguage
      )

      await gupshupService.sendTextMessage(session.phoneNumber, confirmationMessage)

      // Schedule reminders
      await this.scheduleAppointmentReminders(appointment, session, gupshupService)

      // Update referral status
      await this.updateReferralStatus(referralId, this.testStates.SAMPLE_COLLECTION_SCHEDULED)

      return {
        type: 'lab_appointment_confirmed',
        appointmentId: appointment.id,
        appointmentTime: appointment.scheduledTime,
        labInfo: selectedLab,
        totalCost: finalCostBreakdown.patientResponsibility,
        message: confirmationMessage
      }

    } catch (error: any) {
      console.error('Lab selection processing failed', {
        referralId,
        selectedLabId,
        error: error.message
      })
      throw error
    }
  }

  async processLabResults(appointmentId: string, rawResults: any[], session: any, gupshupService: any): Promise<any> {
    try {
      console.log('Processing lab results', {
        appointmentId,
        resultCount: rawResults.length,
        patientPhone: session.phoneNumber
      })

      const appointment = await this.getAppointmentById(appointmentId)
      const labReferral = this.activeTests.get(appointment?.referralId)

      // Parse and validate results
      const processedResults = await this.parseLabResults(rawResults, labReferral?.tests || [])
      
      // Analyze results
      const resultAnalysis = await this.analyzeLabResults(processedResults, session)

      // Create lab report
      const labReport = {
        id: this.generateLabReportId(),
        appointmentId,
        referralId: appointment?.referralId,
        patientId: session.patientId,
        providerId: labReferral?.providerId,
        labId: appointment?.labId,
        completedAt: new Date(),
        
        results: processedResults,
        analysis: resultAnalysis,
        normalRanges: await this.getNormalRanges(processedResults),
        
        abnormalFindings: resultAnalysis.abnormalFindings,
        criticalValues: resultAnalysis.criticalValues,
        clinicalSignificance: await this.assessClinicalSignificance(processedResults, labReferral),
        
        patientFriendlyReport: await this.generatePatientReport(processedResults, session.preferredLanguage),
        providerReport: await this.generateProviderReport(processedResults, resultAnalysis),
        
        status: 'completed'
      }

      // Store results
      if (this.healthRecordService) {
        await this.healthRecordService.addLabResultsToRecord(session.patientId, labReport)
      }

      // Handle critical results
      if (resultAnalysis.hasCriticalValues) {
        await this.handleCriticalResults(labReport, session, gupshupService)
      }

      // Send results to patient
      await this.deliverResultsToPatient(labReport, session, gupshupService)

      // Update status
      await this.updateAppointmentStatus(appointmentId, this.testStates.RESULTS_DELIVERED)
      await this.updateReferralStatus(appointment?.referralId, this.testStates.RESULTS_DELIVERED)

      // Suggest follow-up
      await this.suggestFollowUpActions(labReport, session, gupshupService)

      // Clean up tracking
      if (appointment?.referralId) {
        this.activeTests.delete(appointment.referralId)
      }

      return {
        reportId: labReport.id,
        hasCriticalValues: resultAnalysis.hasCriticalValues,
        abnormalFindings: resultAnalysis.abnormalFindings.length,
        followUpRecommended: labReport.clinicalSignificance.requiresFollowUp,
        deliveryStatus: 'completed'
      }

    } catch (error: any) {
      console.error('Lab results processing failed', {
        appointmentId,
        error: error.message
      })
      throw error
    }
  }

  async integrateWithConversationFlow(session: any, labSelectionData: any, gupshupService: any): Promise<any> {
    try {
      const { action, referralId, labId, appointmentTime } = labSelectionData

      switch (action) {
        case 'select_lab':
          return await this.handleLabSelection(referralId, labId, appointmentTime, session, gupshupService)
          
        case 'view_test_info':
          return await this.sendTestInformation(referralId, session, gupshupService)
          
        case 'reschedule_appointment':
          return await this.handleAppointmentReschedule(referralId, appointmentTime, session, gupshupService)
          
        case 'check_results':
          return await this.checkResultsStatus(referralId, session, gupshupService)
          
        default:
          throw new Error(`Unknown lab action: ${action}`)
      }

    } catch (error: any) {
      console.error('Lab conversation integration failed', {
        sessionId: session.id,
        action: labSelectionData.action,
        error: error.message
      })
      throw error
    }
  }

  private async validateLabOrders(labOrders: any, session: any): Promise<any> {
    const errors = []

    if (!labOrders) {
      errors.push('No lab orders provided')
      return { isValid: false, errors }
    }

    if (!labOrders.tests || labOrders.tests.length === 0) {
      errors.push('No tests specified')
    }

    return {
      isValid: errors.length === 0,
      errors
    }
  }

  private async processIndividualTests(tests: any[]): Promise<any[]> {
    return tests.map(test => ({
      id: this.generateTestId(),
      name: test.name || 'Unknown Test',
      category: test.category || this.testCategories.BLOOD_CHEMISTRY,
      urgency: test.urgency || 'routine',
      fastingRequired: test.fastingRequired || false,
      estimatedCost: test.estimatedCost || 2000, // Default NGN 2,000
      processingTime: test.processingTime || '24 hours'
    }))
  }

  private async generatePreparationInstructions(tests: any[], language: string): Promise<string[]> {
    const instructions: Record<string, string[]> = {
      en: [
        "Fast for 8-12 hours before blood tests (if required)",
        "Drink plenty of water unless instructed otherwise",
        "Take your regular medications unless told to stop",
        "Arrive 15 minutes early for your appointment",
        "Bring a valid ID and your referral letter"
      ],
      pcm: [
        "No chop anything for 8-12 hours before blood test (if dem talk say you should)",
        "Drink plenty water unless dem talk say make you no drink",
        "Take your normal medicine unless dem talk say make you stop",
        "Come 15 minutes before your appointment time",
        "Bring your ID and referral letter"
      ]
    }

    return instructions[language] || instructions.en
  }

  private async findCompatibleLabs(labReferral: any, session: any): Promise<any[]> {
    // Mock labs for demonstration
    return [
      {
        id: '1',
        name: 'Synlab Nigeria',
        location: 'Victoria Island, Lagos',
        distance: '2.3km',
        processingTime: '24-48 hours',
        hasHomeCollection: true,
        estimatedCost: 8500,
        available: true
      },
      {
        id: '2',
        name: 'Pathcare Nigeria',
        location: 'Ikeja, Lagos',
        distance: '4.1km',
        processingTime: '12-36 hours',
        hasHomeCollection: true,
        estimatedCost: 9200,
        available: true
      },
      {
        id: '3',
        name: 'Clina-Lancet Laboratories',
        location: 'Surulere, Lagos',
        distance: '3.7km',
        processingTime: '24-72 hours',
        hasHomeCollection: false,
        estimatedCost: 7800,
        available: true
      }
    ]
  }

  private async analyzeCoverage(labReferral: any, session: any): Promise<any> {
    // Mock coverage analysis
    const totalCost = labReferral.tests.reduce((sum: number, test: any) => sum + (test.estimatedCost || 2000), 0)
    const insuranceCovered = totalCost * 0.7 // Assume 70% coverage
    const patientCost = totalCost - insuranceCovered

    return {
      totalCost,
      insuranceCovered,
      estimatedPatientCost: patientCost,
      coveragePercentage: 0.7
    }
  }

  private async handleNoAvailableLabs(labReferral: any, session: any): Promise<any> {
    return {
      type: 'no_labs_available',
      message: 'No compatible labs found in your area',
      suggestions: ['Try expanding search radius', 'Contact customer support', 'Try again later']
    }
  }

  private async checkTestAvailability(tests: any[], lab: any): Promise<any> {
    return {
      allTestsAvailable: true,
      unavailableTests: [],
      availableAlternatives: []
    }
  }

  private async handlePartialTestAvailability(labReferral: any, lab: any, availability: any, session: any, gupshupService: any): Promise<any> {
    const message = session.preferredLanguage === 'pcm' ?
      "Some test no dey available for dis lab. You wan continue with the ones wey dey available?" :
      "Some tests are not available at this lab. Would you like to continue with the available tests?"

    await gupshupService.sendTextMessage(session.phoneNumber, message)

    return {
      type: 'partial_availability',
      message: 'Some tests not available'
    }
  }

  private async calculateFinalCosts(labReferral: any, lab: any, coverageAnalysis: any): Promise<any> {
    const labCost = lab.estimatedCost || 8500
    const insuranceCovered = labCost * (coverageAnalysis.coveragePercentage || 0)
    const patientResponsibility = labCost - insuranceCovered

    return {
      labCost,
      insuranceCovered,
      patientResponsibility,
      breakdown: {
        tests: labCost * 0.85,
        processing: labCost * 0.10,
        reporting: labCost * 0.05
      }
    }
  }

  private async createLabAppointment(appointmentData: any): Promise<any> {
    return {
      id: this.generateAppointmentId(),
      referralId: appointmentData.referralId,
      labId: appointmentData.labId,
      patientPhone: appointmentData.patientPhone,
      tests: appointmentData.tests,
      scheduledTime: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000), // 2 days from now
      costBreakdown: appointmentData.costBreakdown,
      preparationInstructions: appointmentData.preparationInstructions,
      status: 'scheduled',
      createdAt: new Date()
    }
  }

  private async formatAppointmentConfirmation(appointment: any, lab: any, costBreakdown: any, language: string): Promise<string> {
    const messages: Record<string, string> = {
      en: `🧪 **Lab Appointment Confirmed**\n\n**Lab:** ${lab.name}\n**Location:** ${lab.location}\n**Date:** ${appointment.scheduledTime.toLocaleDateString()}\n**Time:** ${appointment.scheduledTime.toLocaleTimeString()}\n\n**Cost:** ₦${costBreakdown.patientResponsibility.toLocaleString()}\n\n**Preparation:**\n${appointment.preparationInstructions.map((instruction: string) => `• ${instruction}`).join('\n')}\n\nPlease arrive 15 minutes early.`,
      
      pcm: `🧪 **Lab Appointment Confirm**\n\n**Lab:** ${lab.name}\n**Location:** ${lab.location}\n**Date:** ${appointment.scheduledTime.toLocaleDateString()}\n**Time:** ${appointment.scheduledTime.toLocaleTimeString()}\n\n**Money:** ₦${costBreakdown.patientResponsibility.toLocaleString()}\n\n**Wetin You Need Do:**\n${appointment.preparationInstructions.map((instruction: string) => `• ${instruction}`).join('\n')}\n\nCome 15 minutes early.`
    }

    return messages[language] || messages.en
  }

  private async scheduleAppointmentReminders(appointment: any, session: any, gupshupService: any): Promise<void> {
    // Mock reminder scheduling
    console.log(`Scheduling reminders for appointment ${appointment.id}`)
    
    // In a real implementation, this would set up actual reminders
    setTimeout(async () => {
      const reminderMessage = session.preferredLanguage === 'pcm' ?
        `⏰ Reminder: Your lab test appointment na tomorrow. Don't forget to prepare according to the instructions wey dem give you.` :
        `⏰ Reminder: Your lab appointment is tomorrow. Please don't forget to follow the preparation instructions.`
      
      await gupshupService.sendTextMessage(session.phoneNumber, reminderMessage)
    }, 24 * 60 * 60 * 1000) // 24 hours before
  }

  private async parseLabResults(rawResults: any[], tests: any[]): Promise<any[]> {
    // Mock result parsing
    return tests.map((test, index) => ({
      testId: test.id,
      testName: test.name,
      value: rawResults[index]?.value || '12.5',
      unit: rawResults[index]?.unit || 'mg/dL',
      normalRange: '10.0 - 15.0 mg/dL',
      status: rawResults[index]?.status || 'normal',
      completedAt: new Date()
    }))
  }

  private async analyzeLabResults(processedResults: any[], session: any): Promise<any> {
    const abnormalFindings = processedResults.filter(result => result.status !== 'normal')
    const criticalValues = processedResults.filter(result => result.status === 'critical')

    return {
      abnormalFindings,
      criticalValues,
      hasCriticalValues: criticalValues.length > 0,
      overallAssessment: abnormalFindings.length === 0 ? 'normal' : 'abnormal',
      recommendedAction: abnormalFindings.length > 0 ? 'Consult with your doctor to discuss these results' : 'Results are within normal ranges'
    }
  }

  private async handleCriticalResults(labReport: any, session: any, gupshupService: any): Promise<void> {
    const urgentMessage = session.preferredLanguage === 'pcm' ?
      `🚨 URGENT: Your lab results get some serious values wey need immediate attention. Call your doctor now or go hospital. No delay!` :
      `🚨 URGENT: Your lab results show critical values that require immediate medical attention. Please contact your doctor or go to the hospital immediately.`

    await gupshupService.sendTextMessage(session.phoneNumber, urgentMessage)
  }

  private async deliverResultsToPatient(labReport: any, session: any, gupshupService: any): Promise<void> {
    const resultsMessage = this.formatLabResults(labReport, session.preferredLanguage)
    await gupshupService.sendTextMessage(session.phoneNumber, resultsMessage)
  }

  private formatLabResults(labReport: any, language: string): string {
    const messages: Record<string, string> = {
      en: `📊 **Lab Results Ready**\n\n**Report ID:** ${labReport.id}\n**Completed:** ${labReport.completedAt.toLocaleDateString()}\n\n**Summary:**\n${labReport.analysis.overallAssessment.toUpperCase()}\n\n**Recommendation:**\n${labReport.analysis.recommendedAction}\n\n${labReport.analysis.abnormalFindings.length > 0 ? '⚠️ Some values are outside normal range. Please discuss with your doctor.' : '✅ All values are within normal range.'}`,
      
      pcm: `📊 **Lab Results Don Ready**\n\n**Report ID:** ${labReport.id}\n**Finish:** ${labReport.completedAt.toLocaleDateString()}\n\n**Summary:**\n${labReport.analysis.overallAssessment.toUpperCase()}\n\n**Wetin You Need Do:**\n${labReport.analysis.recommendedAction}\n\n${labReport.analysis.abnormalFindings.length > 0 ? '⚠️ Some values no dey normal. Talk to your doctor about am.' : '✅ Everything dey normal range.'}`
    }

    return messages[language] || messages.en
  }

  private async suggestFollowUpActions(labReport: any, session: any, gupshupService: any): Promise<void> {
    if (labReport.analysis.abnormalFindings.length > 0) {
      const followUpMessage = session.preferredLanguage === 'pcm' ?
        `📋 Next steps: Book appointment with your doctor to discuss dis results. You wan make I help you find doctor?` :
        `📋 Next steps: Schedule a follow-up appointment with your doctor to discuss these results. Would you like help finding a doctor?`

      await gupshupService.sendInteractiveButtons(
        session.phoneNumber,
        followUpMessage,
        [
          { id: 'book_followup', title: '📅 Book Follow-up' },
          { id: 'explain_results', title: '❓ Explain Results' },
          { id: 'get_copy', title: '📄 Get Copy' }
        ]
      )
    }
  }

  // More helper methods would be implemented here...
  private async getAppointmentById(appointmentId: string): Promise<any> {
    // Mock implementation
    return {
      id: appointmentId,
      referralId: 'mock_referral_id',
      labId: 'mock_lab_id'
    }
  }

  private async getNormalRanges(processedResults: any[]): Promise<any> {
    return processedResults.map(result => ({
      testName: result.testName,
      normalRange: result.normalRange,
      unit: result.unit
    }))
  }

  private async assessClinicalSignificance(processedResults: any[], labReferral: any): Promise<any> {
    return {
      requiresFollowUp: processedResults.some(result => result.status !== 'normal'),
      urgencyLevel: 'routine',
      clinicalNotes: 'Results reviewed and documented'
    }
  }

  private async generatePatientReport(processedResults: any[], language: string): Promise<string> {
    return `Patient-friendly report in ${language}`
  }

  private async generateProviderReport(processedResults: any[], resultAnalysis: any): Promise<string> {
    return `Professional medical report for provider review`
  }

  private async updateReferralStatus(referralId: string, status: string): Promise<void> {
    const referral = this.activeTests.get(referralId)
    if (referral) {
      referral.status = status
    }
  }

  private async updateAppointmentStatus(appointmentId: string, status: string): Promise<void> {
    console.log(`Updating appointment ${appointmentId} status to ${status}`)
  }

  private async sendTestInformation(referralId: string, session: any, gupshupService: any): Promise<any> {
    const message = 'Here is information about your ordered tests...'
    await gupshupService.sendTextMessage(session.phoneNumber, message)
    return { type: 'test_info_sent' }
  }

  private async handleAppointmentReschedule(referralId: string, newTime: string, session: any, gupshupService: any): Promise<any> {
    const message = 'Appointment has been rescheduled successfully.'
    await gupshupService.sendTextMessage(session.phoneNumber, message)
    return { type: 'appointment_rescheduled' }
  }

  private async checkResultsStatus(referralId: string, session: any, gupshupService: any): Promise<any> {
    const message = 'Your test results are still being processed. We will notify you once ready.'
    await gupshupService.sendTextMessage(session.phoneNumber, message)
    return { type: 'results_status_checked' }
  }

  private initializeLabNetworks(): Map<string, any> {
    const networks = new Map()
    
    networks.set('synlab', {
      name: 'Synlab Nigeria',
      locations: ['Lagos', 'Abuja', 'Port Harcourt'],
      capabilities: ['blood_chemistry', 'hematology', 'microbiology'],
      homeCollection: true
    })
    
    networks.set('pathcare', {
      name: 'Pathcare Nigeria',
      locations: ['Lagos', 'Abuja', 'Ibadan'],
      capabilities: ['blood_chemistry', 'hematology', 'radiology'],
      homeCollection: true
    })

    return networks
  }

  private initializeNigerianTestDatabase(): Map<string, any> {
    const tests = new Map()
    
    tests.set('malaria_parasite', {
      category: this.testCategories.PARASITOLOGY,
      processingTime: '2-4 hours',
      cost: { min: 1500, max: 3000 }
    })
    
    tests.set('fbc', {
      category: this.testCategories.HEMATOLOGY,
      processingTime: '2-4 hours',
      cost: { min: 2500, max: 5000 }
    })

    return tests
  }

  private generateLabReferralId(): string {
    return `LAB_${Date.now()}_${Math.random().toString(36).substring(7).toUpperCase()}`
  }

  private generateLabReportId(): string {
    return `RPT_${Date.now()}_${Math.random().toString(36).substring(7).toUpperCase()}`
  }

  private generateTestId(): string {
    return `TEST_${Date.now()}_${Math.random().toString(36).substring(7)}`
  }

  private generateAppointmentId(): string {
    return `APPT_${Date.now()}_${Math.random().toString(36).substring(7).toUpperCase()}`
  }
}