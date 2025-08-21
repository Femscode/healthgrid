/**
 * Enhanced Conversation Flow Manager for AI Medical Triage
 * Orchestrates the complete patient journey from initial contact to provider connection
 * Handles multilingual conversations and integrates with all system components
 */
import { SessionManager } from './sessionManager'

export class ConversationFlowManager {
  private sessionManager: SessionManager
  private conversationStates: Record<string, string>
  private metrics: any

  constructor(sessionManager: SessionManager) {
    this.sessionManager = sessionManager
    
    // Define conversation states
    this.conversationStates = {
      INITIAL: 'INITIAL',
      LANGUAGE_SELECTION: 'LANGUAGE_SELECTION',
      COLLECTING_DEMOGRAPHICS: 'COLLECTING_DEMOGRAPHICS',
      COLLECTING_SYMPTOMS: 'COLLECTING_SYMPTOMS',
      ASSESSING_SEVERITY: 'ASSESSING_SEVERITY',
      EMERGENCY_DETECTED: 'EMERGENCY_DETECTED',
      PROVIDER_MATCHING: 'PROVIDER_MATCHING',
      APPOINTMENT_BOOKING: 'APPOINTMENT_BOOKING',
      FOLLOW_UP: 'FOLLOW_UP',
      COMPLETED: 'COMPLETED'
    }

    // Track conversation metrics
    this.metrics = {
      conversationsStarted: 0,
      emergenciesDetected: 0,
      triageCompleted: 0,
      providersMatched: 0,
      averageConversationLength: 0
    }
  }

  async manageConversation(message: any, session: any): Promise<any> {
    try {
      console.log('Managing conversation', {
        phoneNumber: message.phoneNumber,
        currentState: session.conversationState,
        messageType: message.type
      })

      // Handle button/list replies specially
      if (message.isButtonReply || message.isListReply) {
        return await this.handleInteractiveReply(message, session)
      }

      // Route based on current conversation state
      const currentState = session.conversationState || this.conversationStates.INITIAL
      
      switch (currentState) {
        case this.conversationStates.INITIAL:
          return await this.handleInitialContact(message, session)
          
        case this.conversationStates.LANGUAGE_SELECTION:
          return await this.handleLanguageSelection(message, session)
          
        case this.conversationStates.COLLECTING_DEMOGRAPHICS:
          return await this.handleDemographicsCollection(message, session)
          
        case this.conversationStates.COLLECTING_SYMPTOMS:
          return await this.handleSymptomCollection(message, session)
          
        case this.conversationStates.ASSESSING_SEVERITY:
          return await this.handleSeverityAssessment(message, session)
          
        case this.conversationStates.PROVIDER_MATCHING:
          return await this.handleProviderMatching(message, session)
          
        case this.conversationStates.APPOINTMENT_BOOKING:
          return await this.handleAppointmentBooking(message, session)
          
        default:
          console.warn('Unknown conversation state', { 
            state: currentState, 
            phoneNumber: message.phoneNumber 
          })
          return this.handleUnknownState(message, session)
      }

    } catch (error) {
      console.error('Conversation management error', {
        phoneNumber: message.phoneNumber,
        error: error.message
      })
      
      return this.generateErrorResponse(session.preferredLanguage || 'en')
    }
  }

  private async handleInitialContact(message: any, session: any): Promise<any> {
    this.metrics.conversationsStarted++
    
    // Check if this is an emergency right away
    const emergencyCheck = this.checkForEmergency(message.original, 'en')
    if (emergencyCheck.isEmergency) {
      await this.updateSessionState(session.id, this.conversationStates.EMERGENCY_DETECTED)
      return {
        type: 'emergency',
        data: emergencyCheck
      }
    }

    // Send welcome message with language selection
    await this.updateSessionState(session.id, this.conversationStates.LANGUAGE_SELECTION)
    
    return {
      type: 'welcome'
    }
  }

  private async handleLanguageSelection(message: any, session: any): Promise<any> {
    // Extract language from message or detect it
    let selectedLanguage = 'en'
    
    const languageMap: Record<string, string> = {
      'english': 'en',
      'pidgin': 'pcm',
      'yoruba': 'yo',
      'hausa': 'ha',
      'igbo': 'ig'
    }

    // Check if user typed a language name
    const lowerMessage = message.original.toLowerCase()
    for (const [name, code] of Object.entries(languageMap)) {
      if (lowerMessage.includes(name)) {
        selectedLanguage = code
        break
      }
    }

    // Update session with selected language
    await this.sessionManager.updateSession(session.id, {
      preferredLanguage: selectedLanguage,
      conversationState: this.conversationStates.COLLECTING_DEMOGRAPHICS
    })

    // Send demographics collection message in selected language
    const welcomeMessage = this.getLocalizedMessage('hello', selectedLanguage)
    const demographicsPrompt = this.getLocalizedMessage('demographics_prompt', selectedLanguage)

    return {
      type: 'text',
      message: `${welcomeMessage}\n\n${demographicsPrompt}`
    }
  }

  private async handleDemographicsCollection(message: any, session: any): Promise<any> {
    try {
      // Extract demographics from message
      const demographics = this.extractDemographics(message.original)
      
      // Update session with demographics
      await this.sessionManager.updateSession(session.id, {
        userData: {
          ...session.userData,
          ...demographics
        },
        conversationState: this.conversationStates.COLLECTING_SYMPTOMS
      })

      // Move to symptom collection
      const symptomsPrompt = this.getLocalizedMessage('symptoms_prompt', session.preferredLanguage)
      
      return {
        type: 'text',
        message: symptomsPrompt
      }

    } catch (error) {
      console.error('Demographics collection error', { error: error.message })
      
      // Ask for clarification
      const clarificationMessage = this.getLocalizedMessage('demographics_clarification', session.preferredLanguage)
      return {
        type: 'text',
        message: clarificationMessage
      }
    }
  }

  private async handleSymptomCollection(message: any, session: any): Promise<any> {
    try {
      // Check for emergency keywords first
      const emergencyCheck = this.checkForEmergency(message.original, session.preferredLanguage)
      if (emergencyCheck.isEmergency) {
        await this.updateSessionState(session.id, this.conversationStates.EMERGENCY_DETECTED)
        return {
          type: 'emergency',
          data: emergencyCheck
        }
      }

      // Process symptoms using basic triage logic
      const triageResult = await this.performBasicTriage(message, session)
      
      // Store symptoms in session
      await this.sessionManager.updateSession(session.id, {
        triageData: {
          ...session.triageData,
          symptoms: triageResult.symptoms,
          processedAt: new Date()
        }
      })

      // Check if we need more information
      if (triageResult.needsMoreInfo) {
        const followUpQuestion = this.generateFollowUpQuestion(triageResult, session.preferredLanguage)
        return {
          type: 'text',
          message: followUpQuestion
        }
      }

      // Move to risk assessment
      await this.updateSessionState(session.id, this.conversationStates.ASSESSING_SEVERITY)
      return await this.performRiskAssessment(session)

    } catch (error) {
      console.error('Symptom collection error', { error: error.message })
      
      const errorMessage = this.getLocalizedMessage('symptom_collection_error', session.preferredLanguage)
      return {
        type: 'text',
        message: errorMessage
      }
    }
  }

  private async handleSeverityAssessment(message: any, session: any): Promise<any> {
    // This would normally be handled automatically, but can handle additional input
    return await this.performRiskAssessment(session)
  }

  private async handleProviderMatching(message: any, session: any): Promise<any> {
    try {
      this.metrics.providersMatched++
      
      // Extract provider preference from message
      const preference = this.extractProviderPreference(message.original)
      
      // Get mock provider list
      const providers = await this.findMockProviders(session, preference)
      
      if (providers.length === 0) {
        const noProvidersMessage = this.getLocalizedMessage('no_providers_found', session.preferredLanguage)
        return {
          type: 'text',
          message: noProvidersMessage
        }
      }

      // Create provider selection interface
      const sections = [{
        title: "Available Providers",
        rows: providers.slice(0, 10).map(provider => ({
          id: `provider_${provider.id}`,
          title: provider.name,
          description: `${provider.specialty} • ${provider.distance} • ⭐ ${provider.rating}`
        }))
      }]

      return {
        type: 'interactive',
        message: this.getLocalizedMessage('select_provider', session.preferredLanguage),
        interactive: {
          type: 'list',
          buttonText: 'Select Provider',
          sections: sections
        }
      }

    } catch (error) {
      console.error('Provider matching error', { error: error.message })
      
      const errorMessage = this.getLocalizedMessage('provider_matching_error', session.preferredLanguage)
      return {
        type: 'text',
        message: errorMessage
      }
    }
  }

  private async handleAppointmentBooking(message: any, session: any): Promise<any> {
    // Simplified appointment booking
    const bookingMessage = this.getLocalizedMessage('appointment_booked', session.preferredLanguage)
    await this.updateSessionState(session.id, this.conversationStates.COMPLETED)
    
    return {
      type: 'text',
      message: bookingMessage
    }
  }

  private async handleInteractiveReply(message: any, session: any): Promise<any> {
    const { buttonId, listId } = message
    const replyId = buttonId || listId

    // Handle language selection
    if (replyId?.startsWith('lang_')) {
      const selectedLanguage = replyId.replace('lang_', '')
      await this.sessionManager.updateSession(session.id, {
        preferredLanguage: selectedLanguage,
        conversationState: this.conversationStates.COLLECTING_DEMOGRAPHICS
      })

      const demographicsPrompt = this.getLocalizedMessage('demographics_prompt', selectedLanguage)
      return {
        type: 'text',
        message: demographicsPrompt
      }
    }

    // Handle provider selection
    if (replyId?.startsWith('provider_')) {
      const providerId = replyId.replace('provider_', '')
      return await this.handleProviderSelection(providerId, session)
    }

    // Handle emergency actions
    if (replyId === 'find_hospitals') {
      return await this.findNearbyHospitals(session)
    }

    if (replyId === 'call_emergency') {
      return {
        type: 'text',
        message: '📞 Emergency numbers:\n🚨 199 - Emergency Services\n🚨 112 - Alternative Emergency\n\nCall immediately!'
      }
    }

    // Default handler for unknown interactive replies
    return {
      type: 'text',
      message: 'I didn\'t understand that selection. Please try again.'
    }
  }

  private async handleProviderSelection(providerId: string, session: any): Promise<any> {
    try {
      // Mock provider details
      const provider = {
        id: providerId,
        name: "Dr. John Doe",
        specialty: "General Practitioner",
        location: "Victoria Island, Lagos",
        rating: "4.8"
      }

      // Update session state
      await this.updateSessionState(session.id, this.conversationStates.APPOINTMENT_BOOKING)
      await this.sessionManager.updateSession(session.id, {
        selectedProvider: provider
      })

      // Create booking options
      const bookingButtons = [
        { id: 'book_now', title: '📅 Book Now' },
        { id: 'call_provider', title: '📞 Call Provider' },
        { id: 'get_directions', title: '🗺️ Get Directions' }
      ]

      const providerInfo = this.formatProviderInfo(provider, session.preferredLanguage)
      
      return {
        type: 'interactive',
        message: providerInfo,
        interactive: {
          type: 'button',
          buttons: bookingButtons
        }
      }

    } catch (error) {
      console.error('Provider selection error', { error: error.message })
      
      const errorMessage = this.getLocalizedMessage('provider_selection_error', session.preferredLanguage)
      return {
        type: 'text',
        message: errorMessage
      }
    }
  }

  private async performRiskAssessment(session: any): Promise<any> {
    try {
      this.metrics.triageCompleted++
      
      // Mock assessment logic
      const assessment = {
        riskScore: 3,
        severity: 'MODERATE',
        recommendation: 'Schedule an appointment with a healthcare provider within 24-48 hours',
        likelyConditions: [
          { name: 'Common Cold', confidence: 0.7 },
          { name: 'Flu', confidence: 0.6 },
          { name: 'Allergies', confidence: 0.4 }
        ]
      }
      
      // Update session with results
      await this.sessionManager.updateSession(session.id, {
        triageData: {
          ...session.triageData,
          riskScore: assessment.riskScore,
          severity: assessment.severity,
          recommendation: assessment.recommendation,
          likelyConditions: assessment.likelyConditions,
          assessmentCompleted: new Date()
        }
      })

      // Handle emergency cases immediately
      if (assessment.severity === 'EMERGENCY') {
        this.metrics.emergenciesDetected++
        await this.updateSessionState(session.id, this.conversationStates.EMERGENCY_DETECTED)
        
        return {
          type: 'emergency',
          data: assessment
        }
      }

      // For non-emergency cases, proceed to provider matching
      await this.updateSessionState(session.id, this.conversationStates.PROVIDER_MATCHING)
      
      // Find mock providers
      const providers = await this.findMockProviders(session, assessment)
      
      return {
        type: 'triage_results',
        data: {
          ...assessment,
          providers: providers
        }
      }

    } catch (error) {
      console.error('Risk assessment error', { error: error.message })
      throw error
    }
  }

  private async performBasicTriage(message: any, session: any): Promise<any> {
    // Basic symptom processing
    const symptoms = this.extractSymptoms(message.original)
    
    return {
      symptoms: symptoms,
      needsMoreInfo: symptoms.length < 2,
      confidence: symptoms.length > 0 ? 0.8 : 0.3
    }
  }

  private extractSymptoms(text: string): any[] {
    // Basic keyword matching for common symptoms
    const symptomKeywords = [
      'fever', 'headache', 'cough', 'cold', 'pain', 'tired', 'nausea',
      'vomit', 'diarrhea', 'stomach', 'chest', 'throat', 'body aches'
    ]
    
    const lowerText = text.toLowerCase()
    const foundSymptoms = []
    
    for (const symptom of symptomKeywords) {
      if (lowerText.includes(symptom)) {
        foundSymptoms.push({
          name: symptom,
          severity: 'mild',
          duration: 'unknown'
        })
      }
    }
    
    return foundSymptoms
  }

  private checkForEmergency(text: string, language: string = 'en'): any {
    const emergencyKeywords = {
      en: ['emergency', 'dying', 'can\'t breathe', 'chest pain', 'unconscious', 'bleeding', 'heart attack'],
      pcm: ['I dey die', 'kasala', 'wahala big', 'emergency', 'I no fit breathe'],
      yo: ['pajawiri', 'mo ń kú', 'kíákíá', 'ẹmi kò lè mí'],
      ha: ['gaggawa', 'ina mutuwa', 'nan take', 'ba zan iya numfashi ba'],
      ig: ['mberede', 'ana m anwụ', 'ozugbo', 'enweghị m ike iku ume']
    }

    const keywords = emergencyKeywords[language] || emergencyKeywords.en
    const lowerText = text.toLowerCase()
    
    for (const keyword of keywords) {
      if (lowerText.includes(keyword.toLowerCase())) {
        return {
          isEmergency: true,
          keyword: keyword,
          confidence: 0.9
        }
      }
    }

    return { isEmergency: false }
  }

  private extractDemographics(text: string): any {
    const demographics: any = {}
    
    // Extract age
    const ageMatch = text.match(/\b(\d{1,2})\b/)
    if (ageMatch) {
      const age = parseInt(ageMatch[1])
      if (age >= 1 && age <= 120) {
        demographics.age = age
      }
    }

    // Extract gender
    const lowerText = text.toLowerCase()
    if (lowerText.includes('male') && !lowerText.includes('female')) {
      demographics.gender = 'male'
    } else if (lowerText.includes('female')) {
      demographics.gender = 'female'
    }

    return demographics
  }

  private extractProviderPreference(text: string): any {
    return {
      specialty: 'general',
      location: 'nearby'
    }
  }

  private async findMockProviders(session: any, criteria?: any): Promise<any[]> {
    // Mock providers for demonstration
    return [
      {
        id: '1',
        name: 'Dr. Adebayo Johnson',
        specialty: 'General Practice',
        distance: '2.5km',
        rating: '4.8',
        available: true
      },
      {
        id: '2',
        name: 'Dr. Fatima Ali',
        specialty: 'Family Medicine',
        distance: '3.2km',
        rating: '4.7',
        available: true
      },
      {
        id: '3',
        name: 'Lagos Medical Center',
        specialty: 'Multi-specialty',
        distance: '5.1km',
        rating: '4.6',
        available: true
      }
    ]
  }

  private generateFollowUpQuestion(triageResult: any, language: string): string {
    const questions = {
      en: "Can you tell me more about your symptoms? For example, when did they start and how severe are they?",
      pcm: "Abeg tell me more about how your body dey feel? Like when e start and how bad e be?",
      yo: "Ṣé o lè sọ síi nípa àwọn àmì àrùn rẹ? Bí àpẹẹrẹ, ìgbà wo ni wọ́n ti bẹ̀rẹ̀?",
      ha: "Za ka iya gaya mani game da alamun ciwonka? Kamar yaushe suka fara?",
      ig: "Ị nwere ike ịgwa m karịa gbasara ihe na-eme gị? Dịka, olee mgbe ọ malitere?"
    }
    
    return questions[language] || questions.en
  }

  private async findNearbyHospitals(session: any): Promise<any> {
    return {
      type: 'text',
      message: '🏥 Nearby Hospitals:\n\n• Lagos University Teaching Hospital - 15 min\n• General Hospital Marina - 20 min\n• Reddington Hospital - 12 min\n\nFor emergency, call 199 immediately!'
    }
  }

  private formatProviderInfo(provider: any, language: string): string {
    return `👨‍⚕️ **${provider.name}**\n\n**Specialty:** ${provider.specialty}\n**Location:** ${provider.location}\n**Rating:** ⭐ ${provider.rating}\n\nWhat would you like to do next?`
  }

  private handleUnknownState(message: any, session: any): any {
    return {
      type: 'text',
      message: 'I\'m not sure how to help with that. Let me start over. What health concern would you like to discuss today?'
    }
  }

  private getLocalizedMessage(key: string, language: string): string {
    const messages: Record<string, Record<string, string>> = {
      hello: {
        en: 'Hello! Welcome to HealthGrid.',
        pcm: 'Hello! Welcome to HealthGrid.',
        yo: 'Báwo! Káàbọ̀ sí HealthGrid.',
        ha: 'Sannu! Maraba da zuwa HealthGrid.',
        ig: 'Ndewo! Nnọọ na HealthGrid.'
      },
      demographics_prompt: {
        en: 'Great! Now please tell me your age and gender. For example: "I am 25 years old, male"',
        pcm: 'Good! Now tell me your age and if you be man or woman. Like: "I be 25 years old, man"',
        yo: 'Ó dára! Ní báyìí sọ ọjọ́ orí rẹ àti bí o bá jẹ́ ọkùnrin tàbí obìnrin fún mi',
        ha: 'Madalla! Yanzu gaya mani shekarunka da kuma ko namiji ne ko mace',
        ig: 'Ọ dị mma! Ugbu a gwa m afọ gị na ma ị bụ nwoke ma ọ bụ nwanyị'
      },
      symptoms_prompt: {
        en: 'Thank you. Now please describe your symptoms in detail. What are you feeling? When did it start?',
        pcm: 'Thank you. Now tell me wetin dey worry you. How your body dey feel? When e start?',
        yo: 'Ó ṣeun. Ní báyìí ṣàlàyé àwọn àmì àrùn rẹ. Kí ni o ń rò? Ìgbà wo ni ó bẹ̀rẹ̀?',
        ha: 'Na gode. Yanzu bayyana alamun ciwonka. Me kake ji? Yaushe ya fara?',
        ig: 'Daalụ. Ugbu a kọwaa ihe na-eme gị. Kedụ ihe ị na-enwe mmetụta? Olee mgbe ọ malitere?'
      },
      demographics_clarification: {
        en: 'I need a bit more information. Please tell me your age and whether you are male or female.',
        pcm: 'I need small more information. Please tell me your age and if you be man or woman.',
        yo: 'Mo nílò àlàyé díẹ̀ síi. Jọ̀wọ́ sọ ọjọ́ orí rẹ àti bí o bá jẹ́ ọkùnrin tàbí obìnrin.',
        ha: 'Ina bukatar karin bayani. Da fatan za a gaya mani shekarunka da kuma ko namiji ne ko mace.',
        ig: 'Achọrọ m ntakịrị ozi ọzọ. Biko gwa m afọ gị na ma ị bụ nwoke ma ọ bụ nwanyị.'
      },
      symptom_collection_error: {
        en: 'I had trouble understanding your symptoms. Please try describing them again.',
        pcm: 'I no understand your symptoms well. Please try talk am again.',
        yo: 'Mo ní ìṣòro láti mọ̀ àwọn àmì àrùn rẹ. Jọ̀wọ́ gbìyànjú láti tún ṣàlàyé wọn.',
        ha: 'Na sami matsala wajen fahimtar alamun ciwonka. Da fatan za a sake bayyanawa.',
        ig: 'Enwere m nsogbu ịghọta ihe na-eme gị. Biko nwaa ịkọwa ya ọzọ.'
      },
      no_providers_found: {
        en: 'I couldn\'t find any available providers in your area right now. Please try again later.',
        pcm: 'I no see any doctor for your area now. Please try again later.',
        yo: 'Kò sí dókítà kankan tí mo rí ní agbègbè rẹ nísinsin yìí. Jọ̀wọ́ gbìyànjú lẹ́yìn.',
        ha: 'Ban sami wani likita a yankinku ba a yanzu. Da fatan za a sake gwadawa daga baya.',
        ig: 'Ahụghị m dọkịta ọ bụla dị na mpaghara gị ugbu a. Biko nwaa ọzọ ma ọ bụzie.'
      },
      select_provider: {
        en: 'Based on your symptoms, here are some recommended healthcare providers:',
        pcm: 'From wetin you talk, na dis doctors I recommend for you:',
        yo: 'Láti inú àwọn àmì àrùn rẹ, wọ̀nyí ni àwọn dókítà tí mo yàn fún ọ:',
        ha: 'Daga alamun ciwonka, ga wadannan likitocin da nake bada shawarar:',
        ig: 'Site na ihe na-eme gị, ndị a bụ ndị dọkịta m na-akwado:'
      },
      provider_matching_error: {
        en: 'I had trouble finding providers for you. Please try again.',
        pcm: 'I get problem to find doctor for you. Please try again.',
        yo: 'Mo ní ìṣòro láti wá àwọn dókítà fún ọ. Jọ̀wọ́ gbìyànjú lẹ́yìn.',
        ha: 'Na sami matsala wajen neman likitoci muku. Da fatan za a sake gwadawa.',
        ig: 'Enwere m nsogbu ịchọtara gị ndị dọkịta. Biko nwaa ọzọ.'
      },
      provider_selection_error: {
        en: 'There was an error with your provider selection. Please try again.',
        pcm: 'Problem dey with the doctor wey you pick. Please try again.',
        yo: 'Ìṣòro kan wà pẹ̀lú dókítà tí o yan. Jọ̀wọ́ gbìyànjú lẹ́yìn.',
        ha: 'Akwai matsala da zabin likitan da ka yi. Da fatan za a sake gwadawa.',
        ig: 'Enwere nsogbu na nhọrọ dọkịta gị. Biko nwaa ọzọ.'
      },
      appointment_booked: {
        en: 'Great! Your appointment has been scheduled. You will receive a confirmation message shortly.',
        pcm: 'Good! Your appointment don ready. You go get confirmation message soon.',
        yo: 'Ó dára! A ti ṣètò ìpàdé rẹ. Ìwé ìjẹ́rìísí ni ìwọ yóò gbà láìpẹ́.',
        ha: 'Madalla! An shirya alkawarinku. Za ku sami sakon tabbatar da hakan nan ba da jimawa ba.',
        ig: 'Ọ dị mma! Ahọpụtala oge nzukọ gị. Ị ga-enweta ozi nkwenye n\'oge na-adịghị anya.'
      }
    }

    return messages[key]?.[language] || messages[key]?.en || 'Message not found'
  }

  private async updateSessionState(sessionId: string, newState: string): Promise<void> {
    await this.sessionManager.updateSession(sessionId, {
      conversationState: newState,
      lastStateUpdate: new Date()
    })
  }

  private generateErrorResponse(language: string): any {
    const errorMessage = this.getLocalizedMessage('general_error', language) || 
        'I apologize, but I encountered an error. Please try again.'
    
    return {
      type: 'text',
      message: errorMessage
    }
  }

  getMetrics(): any {
    return {
      ...this.metrics,
      timestamp: new Date().toISOString()
    }
  }
}