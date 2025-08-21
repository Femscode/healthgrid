/**
 * HMO Integration and Managed Care Service
 * Manages relationships with Nigerian Health Maintenance Organizations
 */
export class HMOService {
  private healthRecordService: any
  private insuranceService: any
  private hmoProviders: Map<string, any>
  private hmoWorkflowStates: Record<string, string>
  private authorizationTypes: Record<string, string>
  private activeCases: Map<string, any>

  constructor(healthRecordService: any, insuranceService: any) {
    this.healthRecordService = healthRecordService
    this.insuranceService = insuranceService
    
    this.hmoProviders = this.initializeNigerianHMOs()
    
    this.hmoWorkflowStates = {
      ENROLLMENT_VERIFICATION: 'enrollment_verification',
      PRIMARY_CARE_REFERRAL: 'primary_care_referral',
      SPECIALIST_AUTHORIZATION: 'specialist_authorization', 
      SERVICE_PRE_APPROVAL: 'service_pre_approval',
      CARE_COORDINATION: 'care_coordination',
      CLAIM_PROCESSING: 'claim_processing',
      COMPLETED: 'completed'
    }

    this.authorizationTypes = {
      TELEMEDICINE_CONSULTATION: 'telemedicine_consultation',
      SPECIALIST_REFERRAL: 'specialist_referral',
      DIAGNOSTIC_TESTS: 'diagnostic_tests',
      PRESCRIPTION_AUTHORIZATION: 'prescription_authorization',
      HOSPITAL_ADMISSION: 'hospital_admission',
      EMERGENCY_CARE: 'emergency_care'
    }

    this.activeCases = new Map()
  }

  async verifyHMOEnrollment(membershipInfo: any, session: any): Promise<any> {
    try {
      console.log('Verifying HMO enrollment', {
        hmoProvider: membershipInfo.hmoProvider,
        membershipNumber: membershipInfo.membershipNumber,
        patientPhone: session.phoneNumber
      })

      const hmoProvider = this.hmoProviders.get(membershipInfo.hmoProvider)
      if (!hmoProvider) {
        throw new Error(`Unsupported HMO provider: ${membershipInfo.hmoProvider}`)
      }

      // Mock enrollment verification
      const isActive = Math.random() > 0.2 // 80% success rate for demo

      if (isActive) {
        // Mock benefits information
        const benefitsInfo = {
          primaryCareAccess: true,
          specialistCoverage: 'with_referral',
          diagnosticCoverage: '80%',
          prescriptionCoverage: '70%',
          telemedicineCoverage: true,
          annualLimit: 1500000, // NGN 1.5M
          copayments: {
            primaryCare: 500,    // NGN 500
            specialist: 1000,   // NGN 1,000
            emergency: 2000     // NGN 2,000
          },
          specialistRequiresReferral: true
        }

        // Mock network providers
        const networkProviders = await this.getNetworkProviders(
          membershipInfo.hmoProvider,
          session.location,
          ['primary_care', 'specialist']
        )

        // Create HMO case
        const hmoCase = await this.createHMOCase({
          membershipNumber: membershipInfo.membershipNumber,
          hmoProvider: membershipInfo.hmoProvider,
          patientId: session.patientId,
          patientPhone: session.phoneNumber,
          enrollmentInfo: {
            planName: `${hmoProvider.name} Corporate Plan`,
            memberSince: '2023-01-01',
            planType: 'corporate',
            employerName: 'Tech Company Ltd'
          },
          benefitsInfo,
          networkProviders,
          caseStatus: this.hmoWorkflowStates.ENROLLMENT_VERIFICATION,
          createdAt: new Date()
        })

        return {
          enrolled: true,
          caseId: hmoCase.id,
          memberInfo: {
            planName: `${hmoProvider.name} Corporate Plan`,
            memberSince: '2023-01-01',
            planType: 'corporate',
            employerName: 'Tech Company Ltd'
          },
          benefits: benefitsInfo,
          networkAccess: {
            providersAvailable: networkProviders.length,
            nearbyProviders: networkProviders.filter((p: any) => p.distance < 10000),
            specialistAccessRequired: benefitsInfo.specialistRequiresReferral
          }
        }
      } else {
        return {
          enrolled: false,
          reason: 'Membership not active or expired',
          suggestions: ['Contact your employer HR', 'Verify membership number', 'Check payment status']
        }
      }

    } catch (error) {
      console.error('HMO enrollment verification failed', {
        hmoProvider: membershipInfo.hmoProvider,
        error: error.message
      })
      
      return {
        enrolled: false,
        reason: 'Unable to verify HMO enrollment at this time',
        error: error.message
      }
    }
  }

  async coordinateHMOCare(caseId: string, serviceRequest: any, session: any, gupshupService: any): Promise<any> {
    try {
      const hmoCase = this.activeCases.get(caseId)
      if (!hmoCase) {
        throw new Error('HMO case not found')
      }

      console.log('Coordinating HMO care', {
        caseId,
        serviceType: serviceRequest.type,
        hmoProvider: hmoCase.hmoProvider
      })

      // Determine care coordination pathway
      const coordinationPlan = await this.determineCareCoordinationPlan(
        serviceRequest,
        hmoCase.benefitsInfo,
        session
      )

      let coordinationResult

      switch (coordinationPlan.pathway) {
        case 'direct_access':
          coordinationResult = await this.handleDirectAccess(serviceRequest, hmoCase, session, gupshupService)
          break

        case 'primary_care_referral':
          coordinationResult = await this.handlePrimaryCareReferral(serviceRequest, hmoCase, session, gupshupService)
          break

        case 'specialist_authorization':
          coordinationResult = await this.handleSpecialistAuthorization(serviceRequest, hmoCase, session, gupshupService)
          break

        case 'emergency_protocol':
          coordinationResult = await this.handleEmergencyProtocol(serviceRequest, hmoCase, session, gupshupService)
          break

        default:
          throw new Error(`Unknown coordination pathway: ${coordinationPlan.pathway}`)
      }

      // Update HMO case
      hmoCase.lastService = serviceRequest
      hmoCase.coordinationResult = coordinationResult
      hmoCase.caseStatus = coordinationResult.nextStatus
      hmoCase.updatedAt = new Date()

      return coordinationResult

    } catch (error) {
      console.error('HMO care coordination failed', {
        caseId,
        serviceType: serviceRequest.type,
        error: error.message
      })
      throw error
    }
  }

  async integrateWithConversationFlow(session: any, hmoAction: any, gupshupService: any): Promise<any> {
    try {
      const { action, caseId, data } = hmoAction

      switch (action) {
        case 'verify_enrollment':
          return await this.verifyHMOEnrollment(data.membershipInfo, session)
          
        case 'coordinate_care':
          return await this.coordinateHMOCare(caseId, data.serviceRequest, session, gupshupService)
          
        case 'select_network_provider':
          return await this.handleNetworkProviderSelection(caseId, data.providerId, session, gupshupService)
          
        case 'check_benefits':
          return await this.provideBenefitsInformation(caseId, session, gupshupService)
          
        default:
          throw new Error(`Unknown HMO action: ${action}`)
      }

    } catch (error) {
      console.error('HMO conversation integration failed', {
        sessionId: session.id,
        action: hmoAction.action,
        error: error.message
      })
      throw error
    }
  }

  private async determineCareCoordinationPlan(serviceRequest: any, benefitsInfo: any, session: any): Promise<any> {
    // Simple coordination logic for demo
    if (serviceRequest.type === 'emergency') {
      return { pathway: 'emergency_protocol' }
    }

    if (serviceRequest.type === 'telemedicine' && benefitsInfo.telemedicineCoverage) {
      return { pathway: 'direct_access' }
    }

    if (serviceRequest.type === 'specialist' && benefitsInfo.specialistRequiresReferral) {
      return { pathway: 'primary_care_referral' }
    }

    return { pathway: 'direct_access' }
  }

  private async handleDirectAccess(serviceRequest: any, hmoCase: any, session: any, gupshupService: any): Promise<any> {
    try {
      // Find network providers
      const eligibleProviders = await this.findNetworkProviders(
        hmoCase.hmoProvider,
        serviceRequest.type,
        session.location
      )

      if (eligibleProviders.length === 0) {
        return await this.handleNoNetworkProviders(serviceRequest, hmoCase, session, gupshupService)
      }

      // Create service authorization
      const authorization = await this.createServiceAuthorization({
        caseId: hmoCase.id,
        membershipNumber: hmoCase.membershipNumber,
        serviceType: serviceRequest.type,
        eligibleProviders: eligibleProviders,
        copayment: hmoCase.benefitsInfo.copayments.primaryCare || 0,
        validUntil: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) // 7 days
      })

      // Send provider selection
      const selectionMessage = await this.formatProviderSelection(
        eligibleProviders,
        authorization,
        session.preferredLanguage
      )

      await gupshupService.sendInteractiveButtons(
        session.phoneNumber,
        selectionMessage.text,
        selectionMessage.buttons
      )

      return {
        type: 'direct_access_approved',
        authorizationId: authorization.id,
        eligibleProviders: eligibleProviders.length,
        copayment: authorization.copayment,
        nextStatus: this.hmoWorkflowStates.SERVICE_PRE_APPROVAL,
        message: 'Service authorized - select your preferred provider'
      }

    } catch (error) {
      console.error('Direct access handling failed', { error: error.message })
      throw error
    }
  }

  private async handlePrimaryCareReferral(serviceRequest: any, hmoCase: any, session: any, gupshupService: any): Promise<any> {
    try {
      // Check if patient has assigned primary care physician
      const primaryCareProvider = await this.getAssignedPrimaryCareProvider(
        hmoCase.membershipNumber,
        hmoCase.hmoProvider
      )

      if (!primaryCareProvider) {
        return await this.initiateProviderSelection('primary_care', hmoCase, session, gupshupService)
      }

      // Create referral to primary care
      const referral = await this.createPrimaryCareReferral({
        caseId: hmoCase.id,
        primaryCareProviderId: primaryCareProvider.id,
        requestedService: serviceRequest,
        patientPhone: session.phoneNumber,
        urgency: serviceRequest.urgency || 'routine',
        clinicalInfo: session.triageData
      })

      // Send referral confirmation
      const referralMessage = this.formatPrimaryCareReferralMessage(
        primaryCareProvider,
        referral,
        session.preferredLanguage
      )

      await gupshupService.sendTextMessage(session.phoneNumber, referralMessage)

      return {
        type: 'primary_care_referral_created',
        referralId: referral.id,
        primaryCareProvider: primaryCareProvider.name,
        estimatedWaitTime: '2-3 business days',
        nextStatus: this.hmoWorkflowStates.PRIMARY_CARE_REFERRAL,
        message: 'Referral sent to your primary care physician'
      }

    } catch (error) {
      console.error('Primary care referral failed', { error: error.message })
      throw error
    }
  }

  private async handleSpecialistAuthorization(serviceRequest: any, hmoCase: any, session: any, gupshupService: any): Promise<any> {
    const message = session.preferredLanguage === 'pcm' ?
      "Your HMO need authorization for specialist. Dis one go take 2-3 days. We go send you message when dem approve am." :
      "Your HMO requires authorization for specialist consultation. This typically takes 2-3 business days. We'll notify you once approved."

    await gupshupService.sendTextMessage(session.phoneNumber, message)

    return {
      type: 'specialist_authorization_pending',
      estimatedProcessingTime: '2-3 business days',
      nextStatus: this.hmoWorkflowStates.SPECIALIST_AUTHORIZATION
    }
  }

  private async handleEmergencyProtocol(serviceRequest: any, hmoCase: any, session: any, gupshupService: any): Promise<any> {
    const message = session.preferredLanguage === 'pcm' ?
      "🚨 Emergency! Your HMO dey cover emergency. Go any hospital wey dey your network. Call 199 for ambulance!" :
      "🚨 Emergency detected! Your HMO covers emergency care. Please go to any network hospital immediately. Call 199 for ambulance!"

    await gupshupService.sendTextMessage(session.phoneNumber, message)

    return {
      type: 'emergency_protocol_activated',
      message: 'Emergency care authorized',
      nextStatus: this.hmoWorkflowStates.COMPLETED
    }
  }

  private async handleNoNetworkProviders(serviceRequest: any, hmoCase: any, session: any, gupshupService: any): Promise<any> {
    const message = session.preferredLanguage === 'pcm' ?
      "Sorry, no network doctor dey available for your area now. You fit call your HMO customer service or try again later." :
      "Sorry, no network providers are available in your area currently. You can contact your HMO customer service or try again later."

    await gupshupService.sendTextMessage(session.phoneNumber, message)

    return {
      type: 'no_network_providers',
      message: 'No network providers available'
    }
  }

  private async createHMOCase(caseData: any): Promise<any> {
    const hmoCase = {
      id: this.generateCaseId(),
      ...caseData,
      createdAt: new Date()
    }

    // Store in active cases
    this.activeCases.set(hmoCase.id, hmoCase)

    return hmoCase
  }

  private async createServiceAuthorization(authData: any): Promise<any> {
    return {
      id: this.generateAuthorizationId(),
      caseId: authData.caseId,
      membershipNumber: authData.membershipNumber,
      serviceType: authData.serviceType,
      eligibleProviders: authData.eligibleProviders,
      copayment: authData.copayment,
      validUntil: authData.validUntil,
      status: 'active',
      createdAt: new Date()
    }
  }

  private async createPrimaryCareReferral(referralData: any): Promise<any> {
    return {
      id: this.generateReferralId(),
      caseId: referralData.caseId,
      primaryCareProviderId: referralData.primaryCareProviderId,
      requestedService: referralData.requestedService,
      patientPhone: referralData.patientPhone,
      urgency: referralData.urgency,
      status: 'pending',
      createdAt: new Date()
    }
  }

  private async getNetworkProviders(hmoProvider: string, location: any, providerTypes: string[]): Promise<any[]> {
    // Mock network providers
    return [
      {
        id: '1',
        name: 'Lagos Medical Center',
        type: 'primary_care',
        specialty: 'General Practice',
        distance: 2500,
        inNetwork: true
      },
      {
        id: '2',
        name: 'Victoria Island Clinic',
        type: 'primary_care',
        specialty: 'Family Medicine',
        distance: 3200,
        inNetwork: true
      }
    ]
  }

  private async findNetworkProviders(hmoProvider: string, serviceType: string, location: any): Promise<any[]> {
    return await this.getNetworkProviders(hmoProvider, location, [serviceType])
  }

  private async getAssignedPrimaryCareProvider(membershipNumber: string, hmoProvider: string): Promise<any> {
    // Mock assigned PCP
    return {
      id: 'pcp_1',
      name: 'Dr. Adebayo Ogundimu',
      specialty: 'Family Medicine',
      clinic: 'Lagos Medical Center',
      phone: '+234-803-123-4567'
    }
  }

  private async formatProviderSelection(providers: any[], authorization: any, language: string): Promise<any> {
    const messages: Record<string, string> = {
      en: `🏥 **Network Providers Available**\n\n**Your Copay:** ₦${authorization.copayment.toLocaleString()}\n**Authorization Valid Until:** ${authorization.validUntil.toLocaleDateString()}\n\nSelect your preferred provider:`,
      
      pcm: `🏥 **Network Doctor Dem Dey Available**\n\n**Wetin You Go Pay:** ₦${authorization.copayment.toLocaleString()}\n**Authorization Valid Till:** ${authorization.validUntil.toLocaleDateString()}\n\nPick the doctor wey you like:`
    }

    const buttons = providers.slice(0, 3).map(provider => ({
      id: `network_provider_${provider.id}`,
      title: provider.name.substring(0, 20)
    }))

    return {
      text: messages[language] || messages.en,
      buttons
    }
  }

  private formatPrimaryCareReferralMessage(provider: any, referral: any, language: string): string {
    const messages: Record<string, string> = {
      en: `📋 **Referral Created**\n\n**Primary Care Doctor:** ${provider.name}\n**Clinic:** ${provider.clinic}\n**Phone:** ${provider.phone}\n\n**Referral ID:** ${referral.id}\n\nYour doctor will review your case and contact you within 2-3 business days.`,
      
      pcm: `📋 **Referral Don Ready**\n\n**Your Main Doctor:** ${provider.name}\n**Clinic:** ${provider.clinic}\n**Phone:** ${provider.phone}\n\n**Referral ID:** ${referral.id}\n\nYour doctor go check your case and call you within 2-3 days.`
    }

    return messages[language] || messages.en
  }

  private async handleNetworkProviderSelection(caseId: string, providerId: string, session: any, gupshupService: any): Promise<any> {
    const message = session.preferredLanguage === 'pcm' ?
      "✅ Doctor selected! We go help you book appointment. You go get message with appointment details soon." :
      "✅ Provider selected! We'll help you schedule an appointment. You'll receive appointment details shortly."

    await gupshupService.sendTextMessage(session.phoneNumber, message)

    return {
      type: 'network_provider_selected',
      providerId,
      message: 'Appointment booking initiated'
    }
  }

  private async provideBenefitsInformation(caseId: string, session: any, gupshupService: any): Promise<any> {
    const hmoCase = this.activeCases.get(caseId)
    if (!hmoCase) {
      throw new Error('HMO case not found')
    }

    const benefits = hmoCase.benefitsInfo
    const message = session.preferredLanguage === 'pcm' ?
      `📋 **Your HMO Benefits**\n\n• Primary Care: ✅ Covered (Pay ₦${benefits.copayments.primaryCare.toLocaleString()})\n• Specialist: ${benefits.specialistCoverage} (Pay ₦${benefits.copayments.specialist.toLocaleString()})\n• Medicine: ${benefits.prescriptionCoverage} coverage\n• Emergency: ✅ Covered (Pay ₦${benefits.copayments.emergency.toLocaleString()})\n• Year Limit: ₦${benefits.annualLimit.toLocaleString()}` :
      `📋 **Your HMO Benefits Summary**\n\n• Primary Care: ✅ Covered (₦${benefits.copayments.primaryCare.toLocaleString()} copay)\n• Specialist Care: ${benefits.specialistCoverage} (₦${benefits.copayments.specialist.toLocaleString()} copay)\n• Prescriptions: ${benefits.prescriptionCoverage} coverage\n• Emergency Care: ✅ Covered (₦${benefits.copayments.emergency.toLocaleString()} copay)\n• Annual Limit: ₦${benefits.annualLimit.toLocaleString()}`

    await gupshupService.sendTextMessage(session.phoneNumber, message)

    return {
      type: 'benefits_information_provided',
      benefits: benefits
    }
  }

  private async initiateProviderSelection(providerType: string, hmoCase: any, session: any, gupshupService: any): Promise<any> {
    const message = session.preferredLanguage === 'pcm' ?
      "You need select primary care doctor first. Which doctor you wan choose from your network?" :
      "You need to select a primary care physician first. Which doctor would you like to choose from your network?"

    await gupshupService.sendTextMessage(session.phoneNumber, message)

    return {
      type: 'provider_selection_required',
      providerType,
      message: 'Primary care provider selection required'
    }
  }

  private initializeNigerianHMOs(): Map<string, any> {
    const hmos = new Map()

    hmos.set('total_health_trust', {
      name: 'Total Health Trust',
      type: 'managed_care',
      networkSize: 'large',
      telemedicineSupport: true
    })

    hmos.set('hygeia_hmo', {
      name: 'Hygeia HMO',
      type: 'managed_care',
      networkSize: 'premium',
      telemedicineSupport: true
    })

    hmos.set('integrated_healthcare', {
      name: 'Integrated Healthcare Holdings',
      type: 'managed_care',
      networkSize: 'medium',
      telemedicineSupport: false
    })

    return hmos
  }

  private generateCaseId(): string {
    return `HMO_${Date.now()}_${Math.random().toString(36).substring(7).toUpperCase()}`
  }

  private generateAuthorizationId(): string {
    return `AUTH_${Date.now()}_${Math.random().toString(36).substring(7).toUpperCase()}`
  }

  private generateReferralId(): string {
    return `REF_${Date.now()}_${Math.random().toString(36).substring(7).toUpperCase()}`
  }
}