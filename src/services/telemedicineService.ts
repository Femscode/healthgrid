/**
 * Telemedicine Video Consultation Service
 * Integrates video consultations directly into WhatsApp conversations
 */
export class TelemedicineService {
  private consultationStates: Record<string, string>
  private activeConsultations: Map<string, any>

  constructor() {
    this.consultationStates = {
      SCHEDULED: 'scheduled',
      STARTING: 'starting', 
      IN_PROGRESS: 'in_progress',
      COMPLETED: 'completed',
      CANCELLED: 'cancelled',
      TECHNICAL_ISSUE: 'technical_issue'
    }
    
    // Track active consultations
    this.activeConsultations = new Map()
  }

  async scheduleVideoConsultation(session: any, selectedProvider: any, preferredTime: Date): Promise<any> {
    try {
      console.log('Scheduling video consultation', {
        patientPhone: session.phoneNumber,
        providerId: selectedProvider.id,
        preferredTime
      })

      // Generate unique consultation room
      const consultationId = this.generateConsultationId()
      const roomName = `healthgrid_${consultationId}`
      
      // Create consultation record
      const consultation = {
        id: consultationId,
        sessionId: session.id,
        patientPhone: session.phoneNumber,
        providerId: selectedProvider.id,
        scheduledTime: preferredTime,
        roomName: roomName,
        status: this.consultationStates.SCHEDULED,
        language: session.preferredLanguage,
        triageData: session.triageData,
        cost: 5000, // NGN 5,000 for consultation
        estimatedDuration: 30 // 30 minutes
      }

      // Generate mock access tokens
      const patientToken = this.generateMockToken(roomName, `patient_${session.phoneNumber}`)
      const providerToken = this.generateMockToken(roomName, `provider_${selectedProvider.id}`)

      // Store consultation details for tracking
      this.activeConsultations.set(consultationId, consultation)

      return {
        consultationId,
        scheduledTime: preferredTime,
        provider: selectedProvider,
        patientAccessUrl: this.generatePatientAccessUrl(consultationId, patientToken),
        estimatedDuration: '30 minutes',
        cost: 5000,
        preparationInstructions: this.getPreparationInstructions(session.preferredLanguage)
      }

    } catch (error) {
      console.error('Failed to schedule video consultation', {
        error: error.message,
        sessionId: session.id
      })
      throw new Error('Unable to schedule video consultation. Please try again.')
    }
  }

  async startVideoConsultation(consultationId: string, participantType: string, participantId: string): Promise<any> {
    try {
      const consultation = this.activeConsultations.get(consultationId)
      if (!consultation) {
        throw new Error('Consultation not found')
      }

      // Update consultation status
      consultation.status = this.consultationStates.STARTING
      consultation.startTime = new Date()

      // Generate access credentials
      const accessCredentials = {
        roomName: consultation.roomName,
        token: this.generateMockToken(consultation.roomName, `${participantType}_${participantId}`),
        consultationId,
        participantType
      }

      return {
        accessCredentials,
        consultationInfo: consultation,
        websocketUrl: this.getWebSocketUrl(consultationId),
        recordingEnabled: false // Disabled for demo
      }

    } catch (error) {
      console.error('Failed to start video consultation', {
        consultationId,
        error: error.message
      })
      throw error
    }
  }

  async endConsultation(consultationId: string, reason: string = 'completed'): Promise<any> {
    try {
      const consultation = this.activeConsultations.get(consultationId)
      if (!consultation) {
        throw new Error('Active consultation not found')
      }

      const endTime = new Date()
      const duration = consultation.startTime ? 
        Math.floor((endTime.getTime() - consultation.startTime.getTime()) / 1000 / 60) : 0

      // Update consultation record
      consultation.status = this.consultationStates.COMPLETED
      consultation.endTime = endTime
      consultation.duration = duration
      consultation.endReason = reason

      // Generate consultation summary
      const consultationSummary = {
        consultationId,
        patientPhone: consultation.patientPhone,
        providerId: consultation.providerId,
        duration: `${duration} minutes`,
        completedAt: endTime,
        triageContext: consultation.triageData,
        outcome: 'consultation_completed'
      }

      // Clean up active consultation tracking
      this.activeConsultations.delete(consultationId)

      console.log('Consultation completed successfully', {
        consultationId,
        duration: `${duration} minutes`,
        reason
      })

      return consultationSummary

    } catch (error) {
      console.error('Error ending consultation', {
        consultationId,
        error: error.message
      })
      throw error
    }
  }

  private generateConsultationId(): string {
    return `hg_${Date.now()}_${Math.random().toString(36).substring(7)}`
  }

  private generateMockToken(channelName: string, uid: string): string {
    // Mock token generation for demo
    const timestamp = Date.now()
    const tokenData = `${channelName}_${uid}_${timestamp}`
    return Buffer.from(tokenData).toString('base64')
  }

  private generatePatientAccessUrl(consultationId: string, token: string): string {
    const baseUrl = 'https://consult.healthgrid.ng'
    return `${baseUrl}/join/${consultationId}?token=${encodeURIComponent(token)}&type=patient`
  }

  private getWebSocketUrl(consultationId: string): string {
    return `wss://ws.healthgrid.ng/consultation/${consultationId}`
  }

  private getPreparationInstructions(language: string): string[] {
    const instructions: Record<string, string[]> = {
      en: [
        "Ensure stable internet connection",
        "Find a quiet, private space",
        "Have your ID and any medications ready",
        "Test your camera and microphone"
      ],
      pcm: [
        "Make sure say internet dey work well",
        "Find quiet place wey person no go disturb you",
        "Get your ID and medicine ready",
        "Check say your camera and microphone dey work"
      ],
      yo: [
        "Rí dájú pé àsopọ̀ intánẹ́ẹ̀tì ṣiṣẹ́ dáadáa",
        "Wá ibi tí ó dákẹ́ tí kò sí ariwo",
        "Mú ìwé ẹ̀rí rẹ àti àwọn oògùn tí o ń lo",
        "Ṣàyẹ̀wò kámẹ́rà àti ẹ̀rọ gbohùn rẹ"
      ]
    }

    return instructions[language] || instructions.en
  }

  async integrateWithConversationFlow(session: any, selectedProvider: any, gupshupService: any): Promise<any> {
    try {
      // Schedule the consultation for next available slot (mock: 2 hours from now)
      const scheduledTime = new Date(Date.now() + 2 * 60 * 60 * 1000)
      
      const consultationDetails = await this.scheduleVideoConsultation(
        session, 
        selectedProvider, 
        scheduledTime
      )

      // Format confirmation message
      const confirmationMessage = this.formatSchedulingConfirmation(
        consultationDetails, 
        session.preferredLanguage
      )

      await gupshupService.sendInteractiveButtons(
        session.phoneNumber,
        confirmationMessage,
        [
          { id: 'confirm_consult', title: '✅ Confirm' },
          { id: 'reschedule_consult', title: '📅 Reschedule' },
          { id: 'audio_only_consult', title: '📞 Audio Only' }
        ]
      )

      return {
        type: 'consultation_scheduled',
        data: consultationDetails
      }

    } catch (error) {
      console.error('Telemedicine integration error', { error: error.message })
      throw error
    }
  }

  private formatSchedulingConfirmation(consultationDetails: any, language: string): string {
    const messages: Record<string, string> = {
      en: `🎥 **Video Consultation Scheduled**\n\n**Provider:** ${consultationDetails.provider.name}\n**Date & Time:** ${consultationDetails.scheduledTime.toLocaleString()}\n**Duration:** ${consultationDetails.estimatedDuration}\n**Cost:** ₦${consultationDetails.cost.toLocaleString()}\n\n**Preparation Instructions:**\n${consultationDetails.preparationInstructions.map(instruction => `• ${instruction}`).join('\n')}\n\n**Access Link:** ${consultationDetails.patientAccessUrl}\n\nPlease confirm your appointment below.`,
      
      pcm: `🎥 **Video Call with Doctor Don Ready**\n\n**Doctor:** ${consultationDetails.provider.name}\n**Date & Time:** ${consultationDetails.scheduledTime.toLocaleString()}\n**How Long:** ${consultationDetails.estimatedDuration}\n**Money:** ₦${consultationDetails.cost.toLocaleString()}\n\n**Wetin You Need Do:**\n${consultationDetails.preparationInstructions.map(instruction => `• ${instruction}`).join('\n')}\n\n**Link:** ${consultationDetails.patientAccessUrl}\n\nAbeg confirm your appointment.`
    }

    return messages[language] || messages.en
  }

  async handleConsultationButtons(buttonId: string, session: any, gupshupService: any): Promise<any> {
    switch (buttonId) {
      case 'confirm_consult':
        return await this.confirmConsultation(session, gupshupService)
      
      case 'reschedule_consult':
        return await this.offerRescheduleOptions(session, gupshupService)
        
      case 'audio_only_consult':
        return await this.setupAudioOnlyConsultation(session, gupshupService)
        
      default:
        return null
    }
  }

  private async confirmConsultation(session: any, gupshupService: any): Promise<any> {
    const message = session.preferredLanguage === 'pcm' ?
      "✅ Your appointment don confirm! You go get reminder message 30 minutes before the call. Make sure you get good internet." :
      "✅ Your consultation is confirmed! You'll receive a reminder 30 minutes before your appointment. Please ensure you have a stable internet connection."

    await gupshupService.sendTextMessage(session.phoneNumber, message)
    
    return {
      type: 'consultation_confirmed',
      status: 'confirmed'
    }
  }

  private async offerRescheduleOptions(session: any, gupshupService: any): Promise<any> {
    const message = session.preferredLanguage === 'pcm' ?
      "📅 No wahala! When you wan reschedule the appointment for? Reply with time wey dey convenient for you." :
      "📅 No problem! When would you like to reschedule your appointment? Please reply with your preferred time."

    await gupshupService.sendTextMessage(session.phoneNumber, message)
    
    return {
      type: 'reschedule_requested',
      status: 'awaiting_new_time'
    }
  }

  private async setupAudioOnlyConsultation(session: any, gupshupService: any): Promise<any> {
    const message = session.preferredLanguage === 'pcm' ?
      "📞 Okay! I don change am to phone call only. You go get phone number to call when time reach. This one cheaper pass video call." :
      "📞 Understood! I've switched your consultation to audio-only. You'll receive a phone number to call at your appointment time. This option is more affordable than video."

    await gupshupService.sendTextMessage(session.phoneNumber, message)
    
    return {
      type: 'audio_only_setup',
      status: 'audio_configured'
    }
  }
}