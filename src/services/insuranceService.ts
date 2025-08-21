/**
 * Insurance Claim Processing Service
 * Handles Nigerian health insurance integration including NHIS and private insurers
 */
export class InsuranceService {
  private healthRecordService: any
  private insuranceProviders: Map<string, any>
  private claimStates: Record<string, string>
  private coverageTypes: Record<string, string>

  constructor(healthRecordService: any) {
    this.healthRecordService = healthRecordService
    
    // Initialize insurance providers
    this.insuranceProviders = this.initializeInsuranceProviders()
    
    this.claimStates = {
      INITIATED: 'initiated',
      SUBMITTED: 'submitted',
      PROCESSING: 'processing',
      APPROVED: 'approved',
      DENIED: 'denied',
      PARTIALLY_APPROVED: 'partially_approved',
      PAID: 'paid'
    }

    this.coverageTypes = {
      CONSULTATION: 'consultation',
      PRESCRIPTION: 'prescription',
      DIAGNOSTIC: 'diagnostic',
      EMERGENCY: 'emergency',
      PREVENTIVE: 'preventive'
    }
  }

  async processConsultationClaim(consultationData: any, patientInsurance: any, session: any): Promise<any> {
    try {
      console.log('Processing consultation insurance claim', {
        consultationId: consultationData.id,
        patientPhone: session.phoneNumber,
        insuranceProvider: patientInsurance.provider
      })

      // Validate insurance coverage
      const coverageValidation = await this.validateInsuranceCoverage(
        patientInsurance,
        this.coverageTypes.CONSULTATION
      )

      if (!coverageValidation.isValid) {
        return {
          covered: false,
          reason: coverageValidation.reason,
          patientResponsibility: consultationData.fullCost || 5000
        }
      }

      // Create mock insurance claim
      const claim = await this.createInsuranceClaim({
        type: this.coverageTypes.CONSULTATION,
        patientInsurance,
        serviceDetails: {
          consultationId: consultationData.id,
          providerId: consultationData.providerId,
          serviceDate: consultationData.scheduledTime,
          amount: consultationData.cost || 5000
        },
        patientId: session.patientId,
        sessionId: session.id
      })

      // Mock claim submission
      const submissionResult = await this.submitClaimToProvider(claim, patientInsurance.provider)

      if (submissionResult.success) {
        return {
          covered: true,
          claimId: claim.id,
          claimNumber: submissionResult.claimNumber,
          coverageAmount: submissionResult.approvedAmount,
          patientResponsibility: (consultationData.cost || 5000) - submissionResult.approvedAmount,
          estimatedProcessingTime: '2-3 business days'
        }
      } else {
        return {
          covered: false,
          reason: submissionResult.error,
          patientResponsibility: consultationData.fullCost || 5000,
          claimId: claim.id
        }
      }

    } catch (error) {
      console.error('Consultation claim processing failed', {
        consultationId: consultationData.id,
        error: error.message
      })
      
      return {
        covered: false,
        reason: 'Insurance processing error',
        patientResponsibility: consultationData.fullCost || 5000
      }
    }
  }

  async processPrescriptionClaim(prescription: any, costBreakdown: any, patientInsurance: any): Promise<any> {
    try {
      console.log('Processing prescription insurance claim', {
        prescriptionId: prescription.id,
        medicationCount: prescription.medications.length,
        totalCost: costBreakdown.total
      })

      // Check medication coverage
      const medicationCoverage = await this.checkMedicationCoverage(
        prescription.medications,
        patientInsurance
      )

      // Calculate covered amounts
      const coverageBreakdown = this.calculatePrescriptionCoverage(
        prescription.medications,
        medicationCoverage,
        costBreakdown
      )

      if (coverageBreakdown.totalCoveredAmount > 0) {
        const claim = await this.createInsuranceClaim({
          type: this.coverageTypes.PRESCRIPTION,
          patientInsurance,
          serviceDetails: {
            prescriptionId: prescription.id,
            providerId: prescription.providerId,
            serviceDate: prescription.issuedAt,
            medications: prescription.medications,
            totalAmount: coverageBreakdown.totalCoveredAmount
          }
        })

        const submissionResult = await this.submitClaimToProvider(claim, patientInsurance.provider)

        return {
          covered: true,
          claimId: claim.id,
          claimNumber: submissionResult.claimNumber,
          coverageBreakdown: coverageBreakdown,
          patientResponsibility: costBreakdown.total - coverageBreakdown.totalCoveredAmount,
          preAuthorizationRequired: false
        }
      } else {
        return {
          covered: false,
          reason: 'No medications covered under current plan',
          patientResponsibility: costBreakdown.total,
          coverageBreakdown: coverageBreakdown
        }
      }

    } catch (error) {
      console.error('Prescription claim processing failed', {
        prescriptionId: prescription.id,
        error: error.message
      })
      throw error
    }
  }

  async verifyInsuranceEligibility(insuranceInfo: any, patientData: any): Promise<any> {
    try {
      console.log('Verifying insurance eligibility', {
        provider: insuranceInfo.provider,
        policyNumber: insuranceInfo.policyNumber
      })

      const provider = this.insuranceProviders.get(insuranceInfo.provider)
      if (!provider) {
        throw new Error(`Unsupported insurance provider: ${insuranceInfo.provider}`)
      }

      // Mock eligibility check
      const isEligible = Math.random() > 0.2 // 80% success rate for demo

      if (isEligible) {
        return {
          eligible: true,
          coverageDetails: {
            planName: `${provider.name} Premium Plan`,
            effectiveDate: '2024-01-01',
            expirationDate: '2024-12-31',
            deductible: 50000, // NGN 50,000
            copayments: {
              consultation: 1000, // NGN 1,000 copay
              prescription: 500,   // NGN 500 copay
              emergency: 2000     // NGN 2,000 copay
            },
            coverageLimits: {
              annual: 2000000, // NGN 2,000,000 annual limit
              prescription: 75, // 75% coverage
              consultation: 80  // 80% coverage
            },
            coveredServices: provider.capabilities
          },
          memberInfo: {
            memberSince: '2023-01-01',
            membershipNumber: insuranceInfo.policyNumber
          }
        }
      } else {
        return {
          eligible: false,
          reason: 'Policy not active or expired',
          lastVerificationDate: new Date()
        }
      }

    } catch (error) {
      console.error('Insurance eligibility verification failed', {
        provider: insuranceInfo.provider,
        error: error.message
      })
      
      return {
        eligible: false,
        reason: 'Unable to verify insurance at this time',
        error: error.message
      }
    }
  }

  async integrateWithConversationFlow(session: any, insuranceInfo: any, gupshupService: any): Promise<any> {
    try {
      const eligibilityResult = await this.verifyInsuranceEligibility(
        insuranceInfo,
        session.userData
      )

      let responseMessage
      let responseButtons = []

      if (eligibilityResult.eligible) {
        responseMessage = this.formatInsuranceConfirmation(
          eligibilityResult,
          session.preferredLanguage
        )

        responseButtons = [
          { id: 'confirm_insurance', title: '✅ Confirm Coverage' },
          { id: 'review_benefits', title: '📋 View Benefits' },
          { id: 'update_insurance', title: '✏️ Update Info' }
        ]

        // Store insurance info in session (mock)
        session.insuranceInfo = insuranceInfo
        session.eligibilityResult = eligibilityResult

      } else {
        responseMessage = this.formatInsuranceError(
          eligibilityResult,
          session.preferredLanguage
        )

        responseButtons = [
          { id: 'retry_insurance', title: '🔄 Try Again' },
          { id: 'pay_cash', title: '💳 Pay Directly' },
          { id: 'contact_support', title: '📞 Get Help' }
        ]
      }

      await gupshupService.sendInteractiveButtons(
        session.phoneNumber,
        responseMessage,
        responseButtons
      )

      return {
        type: 'insurance_verification',
        eligible: eligibilityResult.eligible,
        data: eligibilityResult
      }

    } catch (error) {
      console.error('Insurance conversation integration failed', {
        sessionId: session.id,
        error: error.message
      })
      throw error
    }
  }

  private async validateInsuranceCoverage(patientInsurance: any, coverageType: string): Promise<any> {
    // Mock validation logic
    const provider = this.insuranceProviders.get(patientInsurance.provider)
    
    if (!provider) {
      return {
        isValid: false,
        reason: 'Unsupported insurance provider'
      }
    }

    if (!provider.capabilities.includes(coverageType)) {
      return {
        isValid: false,
        reason: `${coverageType} not covered under this plan`
      }
    }

    return {
      isValid: true,
      coverageLevel: provider.capabilities.includes(coverageType) ? 0.8 : 0
    }
  }

  private async createInsuranceClaim(claimData: any): Promise<any> {
    const claim = {
      id: this.generateClaimId(),
      type: claimData.type,
      patientInsurance: claimData.patientInsurance,
      serviceDetails: claimData.serviceDetails,
      patientId: claimData.patientId,
      sessionId: claimData.sessionId,
      status: this.claimStates.INITIATED,
      createdAt: new Date()
    }

    return claim
  }

  private async submitClaimToProvider(claim: any, providerName: string): Promise<any> {
    // Mock submission logic
    const success = Math.random() > 0.1 // 90% success rate

    if (success) {
      const approvedAmount = Math.floor((claim.serviceDetails.amount || 5000) * 0.8) // 80% coverage

      return {
        success: true,
        claimNumber: this.generateClaimNumber(),
        approvedAmount,
        estimatedProcessingTime: '2-3 business days'
      }
    } else {
      return {
        success: false,
        error: 'Claim processing failed'
      }
    }
  }

  private async checkMedicationCoverage(medications: any[], patientInsurance: any): Promise<any> {
    const coverage: Record<string, any> = {}

    // Mock medication coverage
    for (const medication of medications) {
      coverage[medication.name] = {
        covered: Math.random() > 0.3, // 70% coverage rate
        coveragePercentage: Math.random() > 0.5 ? 0.75 : 0.5 // 75% or 50% coverage
      }
    }

    return coverage
  }

  private calculatePrescriptionCoverage(medications: any[], medicationCoverage: any, costBreakdown: any): any {
    let totalCoveredAmount = 0
    const coveredMedications = []
    const uncoveredMedications = []

    for (const medication of medications) {
      const coverage = medicationCoverage[medication.name]
      if (coverage && coverage.covered) {
        const coveredAmount = (medication.totalCost || medication.unitCost * medication.quantity) * coverage.coveragePercentage
        totalCoveredAmount += coveredAmount
        coveredMedications.push({
          ...medication,
          coveredAmount,
          coveragePercentage: coverage.coveragePercentage
        })
      } else {
        uncoveredMedications.push(medication)
      }
    }

    return {
      totalCoveredAmount,
      coveredMedications,
      uncoveredMedications,
      coveragePercentage: totalCoveredAmount / (costBreakdown.total || 1)
    }
  }

  private formatInsuranceConfirmation(eligibilityResult: any, language: string): string {
    const messages: Record<string, string> = {
      en: `✅ **Insurance Verified Successfully**\n\n**Plan:** ${eligibilityResult.coverageDetails.planName}\n**Valid Until:** ${eligibilityResult.coverageDetails.expirationDate}\n\n**Your Coverage:**\n• Consultations: ${eligibilityResult.coverageDetails.coverageLimits.consultation}% covered\n• Copay: ₦${eligibilityResult.coverageDetails.copayments.consultation.toLocaleString()}\n• Prescriptions: ${eligibilityResult.coverageDetails.coverageLimits.prescription}% covered\n• Annual Limit: ₦${eligibilityResult.coverageDetails.coverageLimits.annual.toLocaleString()}\n\nYou can now proceed with your consultation. Most costs will be covered by your insurance.`,
      
      pcm: `✅ **Insurance Don Confirm**\n\n**Plan:** ${eligibilityResult.coverageDetails.planName}\n**Valid Till:** ${eligibilityResult.coverageDetails.expirationDate}\n\n**Wetin Your Insurance Dey Cover:**\n• Doctor Visit: ${eligibilityResult.coverageDetails.coverageLimits.consultation}% coverage\n• You Go Pay: ₦${eligibilityResult.coverageDetails.copayments.consultation.toLocaleString()}\n• Medicine: ${eligibilityResult.coverageDetails.coverageLimits.prescription}% coverage\n• For One Year: ₦${eligibilityResult.coverageDetails.coverageLimits.annual.toLocaleString()}\n\nYou fit continue with your doctor consultation. Insurance go cover most of the money.`
    }

    return messages[language] || messages.en
  }

  private formatInsuranceError(eligibilityResult: any, language: string): string {
    const messages: Record<string, string> = {
      en: `❌ **Insurance Verification Failed**\n\n**Reason:** ${eligibilityResult.reason}\n\nYou can still proceed with your consultation and pay directly. You may also contact your insurance provider to resolve any issues.\n\nWould you like to continue without insurance coverage?`,
      
      pcm: `❌ **Insurance No Work**\n\n**Why E No Work:** ${eligibilityResult.reason}\n\nYou still fit continue with doctor and pay by yourself. You fit also call your insurance company.\n\nYou wan continue without insurance?`
    }

    return messages[language] || messages.en
  }

  private initializeInsuranceProviders(): Map<string, any> {
    const providers = new Map()

    // NHIS (National Health Insurance Scheme)
    providers.set('nhis', {
      name: 'National Health Insurance Scheme',
      type: 'public',
      capabilities: ['consultation', 'prescription', 'emergency', 'diagnostic']
    })

    // AIICO Insurance
    providers.set('aiico', {
      name: 'AIICO Insurance',
      type: 'private',
      capabilities: ['consultation', 'prescription', 'diagnostic', 'emergency', 'preventive']
    })

    // AXA Mansard Insurance
    providers.set('axamansard', {
      name: 'AXA Mansard Insurance',
      type: 'private',
      capabilities: ['consultation', 'prescription', 'diagnostic', 'emergency', 'preventive']
    })

    return providers
  }

  private generateClaimId(): string {
    return `CLM_${Date.now()}_${Math.random().toString(36).substring(7).toUpperCase()}`
  }

  private generateClaimNumber(): string {
    return `${Date.now().toString().slice(-8)}_${Math.random().toString(36).substring(7).toUpperCase()}`
  }
}