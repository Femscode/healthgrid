/**
 * Health Record Integration Service
 * Maintains comprehensive, longitudinal health records for all patient interactions
 */
export class HealthRecordService {
  private db?: any

  constructor(db?: any) {
    this.db = db
  }

  async createHealthRecordFromTriageSession(session: any, triageResults: any, consultationData?: any): Promise<any> {
    try {
      console.log('Creating health record entry', {
        patientPhone: session.phoneNumber,
        sessionId: session.id,
        hasConsultation: !!consultationData
      })

      // Get or create patient record
      const patientRecord = await this.getOrCreatePatientRecord(session)
      
      // Create encounter record
      const encounter = await this.createEncounterRecord({
        patientId: patientRecord.id,
        sessionId: session.id,
        encounterType: consultationData ? 'telemedicine' : 'ai_triage',
        startTime: session.createdAt,
        endTime: new Date(),
        language: session.preferredLanguage,
        location: session.location
      })

      // Process symptoms and conditions
      const conditions = await this.createConditionRecords(
        patientRecord.id, 
        encounter.id, 
        triageResults.likelyConditions || []
      )

      const observations = await this.createObservationRecords(
        patientRecord.id,
        encounter.id,
        triageResults.symptoms || [],
        session.triageData
      )

      // Store records if database available
      if (this.db) {
        await this.storeHealthRecord({
          patientId: patientRecord.id,
          encounterId: encounter.id,
          conditions,
          observations,
          consultation: consultationData
        })
      }

      console.log('Health record created successfully', {
        patientId: patientRecord.id,
        encounterId: encounter.id,
        conditionsRecorded: conditions.length,
        observationsRecorded: observations.length
      })

      return {
        patientId: patientRecord.id,
        encounterId: encounter.id,
        recordsCreated: {
          conditions: conditions.length,
          observations: observations.length,
          consultationNotes: consultationData ? 1 : 0
        }
      }

    } catch (error: any) {
      console.error('Health record creation failed', {
        sessionId: session.id,
        error: error.message
      })
      throw new Error(`Failed to create health record: ${error.message}`)
    }
  }

  async addPrescriptionToRecord(patientId: string, prescription: any): Promise<any> {
    try {
      const medicationRequest = {
        id: this.generateMedicationRequestId(),
        patientId,
        prescriptionId: prescription.id,
        status: 'active',
        intent: 'order',
        authoredOn: prescription.issuedAt,
        medications: prescription.medications.map((med: any) => ({
          name: med.name,
          dosage: med.dosage,
          frequency: med.frequency || 'as prescribed',
          duration: med.duration || '30 days'
        }))
      }

      if (this.db) {
        await this.storeMedicationRequest(medicationRequest)
      }

      console.log('Prescription added to health record', {
        patientId,
        prescriptionId: prescription.id,
        medicationCount: prescription.medications.length
      })

      return medicationRequest

    } catch (error: any) {
      console.error('Failed to add prescription to health record', {
        patientId,
        prescriptionId: prescription.id,
        error: error.message
      })
      throw error
    }
  }

  async recordMedicationCompliance(patientId: string, prescriptionId: string, status: string): Promise<void> {
    try {
      const complianceRecord = {
        patientId,
        prescriptionId,
        status,
        recordedAt: new Date()
      }

      if (this.db) {
        await this.storeComplianceRecord(complianceRecord)
      }

      console.log('Medication compliance recorded', {
        patientId,
        prescriptionId,
        status
      })

    } catch (error: any) {
      console.error('Failed to record medication compliance', {
        patientId,
        prescriptionId,
        error: error.message
      })
    }
  }

  async recordInsuranceOutcome(patientId: string, claimId: string, outcome: any): Promise<void> {
    try {
      const insuranceRecord = {
        patientId,
        claimId,
        outcome: outcome.status,
        amount: outcome.approvedAmount || 0,
        recordedAt: new Date()
      }

      if (this.db) {
        await this.storeInsuranceRecord(insuranceRecord)
      }

      console.log('Insurance outcome recorded', {
        patientId,
        claimId,
        outcome: outcome.status
      })

    } catch (error: any) {
      console.error('Failed to record insurance outcome', {
        patientId,
        claimId,
        error: error.message
      })
    }
  }

  async addLabReferralToRecord(patientId: string, labReferral: any): Promise<void> {
    try {
      const labRecord = {
        id: this.generateLabRecordId(),
        patientId,
        referralId: labReferral.id,
        tests: labReferral.tests,
        status: labReferral.status,
        orderedAt: labReferral.referralDate
      }

      if (this.db) {
        await this.storeLabRecord(labRecord)
      }

      console.log('Lab referral added to health record', {
        patientId,
        referralId: labReferral.id,
        testCount: labReferral.tests.length
      })

    } catch (error: any) {
      console.error('Failed to add lab referral to health record', {
        patientId,
        referralId: labReferral.id,
        error: error.message
      })
    }
  }

  async addLabResultsToRecord(patientId: string, labReport: any): Promise<void> {
    try {
      const resultsRecord = {
        id: this.generateResultsRecordId(),
        patientId,
        reportId: labReport.id,
        results: labReport.results,
        abnormalFindings: labReport.analysis.abnormalFindings,
        completedAt: labReport.completedAt
      }

      if (this.db) {
        await this.storeLabResults(resultsRecord)
      }

      console.log('Lab results added to health record', {
        patientId,
        reportId: labReport.id,
        hasAbnormalFindings: labReport.analysis.hasCriticalValues
      })

    } catch (error: any) {
      console.error('Failed to add lab results to health record', {
        patientId,
        reportId: labReport.id,
        error: error.message
      })
    }
  }

  private async getOrCreatePatientRecord(session: any): Promise<any> {
    try {
      let patientRecord = await this.findPatientByPhone(session.phoneNumber)
      
      if (!patientRecord) {
        patientRecord = await this.createNewPatientRecord({
          phoneNumber: session.phoneNumber,
          preferredLanguage: session.preferredLanguage,
          demographics: session.userData,
          location: session.location,
          createdAt: new Date(),
          healthId: this.generateNigerianHealthId(session.phoneNumber)
        })

        console.log('New patient record created', {
          patientId: patientRecord.id,
          phoneNumber: session.phoneNumber
        })
      }

      return patientRecord

    } catch (error: any) {
      console.error('Patient record handling failed', {
        phoneNumber: session.phoneNumber,
        error: error.message
      })
      throw error
    }
  }

  private async findPatientByPhone(phoneNumber: string): Promise<any> {
    if (!this.db) {
      return null // Mock mode
    }

    try {
      const result = await this.db.prepare(
        'SELECT * FROM patients WHERE phoneNumber = ?'
      ).bind(phoneNumber).first()

      return result
    } catch (error: any) {
      console.error('Failed to find patient by phone', { phoneNumber, error: error.message })
      return null
    }
  }

  private async createNewPatientRecord(patientData: any): Promise<any> {
    const patientRecord = {
      id: this.generatePatientId(),
      ...patientData,
      createdAt: new Date(),
      updatedAt: new Date()
    }

    if (this.db) {
      try {
        await this.db.prepare(`
          INSERT INTO patients (id, phoneNumber, preferredLanguage, healthId, demographics, location, createdAt, updatedAt)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `).bind(
          patientRecord.id,
          patientRecord.phoneNumber,
          patientRecord.preferredLanguage,
          patientRecord.healthId,
          JSON.stringify(patientRecord.demographics || {}),
          patientRecord.location,
          patientRecord.createdAt.toISOString(),
          patientRecord.updatedAt.toISOString()
        ).run()
      } catch (error: any) {
        console.error('Failed to store patient record', { error: error.message })
      }
    }

    return patientRecord
  }

  private async createEncounterRecord(encounterData: any): Promise<any> {
    try {
      const encounter = {
        id: this.generateEncounterId(),
        patientId: encounterData.patientId,
        sessionId: encounterData.sessionId,
        type: encounterData.encounterType,
        status: 'completed',
        period: {
          start: encounterData.startTime,
          end: encounterData.endTime
        },
        language: encounterData.language,
        location: encounterData.location,
        facilityType: 'telemedicine_platform',
        createdAt: new Date()
      }

      return encounter

    } catch (error: any) {
      console.error('Encounter record creation failed', { error: error.message })
      throw error
    }
  }

  private async createConditionRecords(patientId: string, encounterId: string, likelyConditions: any[]): Promise<any[]> {
    try {
      const conditionRecords = []

      for (const condition of likelyConditions) {
        const conditionRecord = {
          id: this.generateConditionId(),
          patientId,
          encounterId,
          name: condition.name,
          confidence: condition.confidence,
          severity: condition.severity || 'unknown',
          clinicalStatus: 'active',
          verificationStatus: 'differential',
          recordedDate: new Date()
        }

        conditionRecords.push(conditionRecord)
      }

      return conditionRecords

    } catch (error: any) {
      console.error('Condition record creation failed', { error: error.message })
      throw error
    }
  }

  private async createObservationRecords(patientId: string, encounterId: string, symptoms: any[], triageData: any): Promise<any[]> {
    try {
      const observationRecords = []

      // Create observations for each symptom
      for (const symptom of symptoms) {
        const observation = {
          id: this.generateObservationId(),
          patientId,
          encounterId,
          status: 'final',
          category: 'survey',
          name: symptom.name,
          value: symptom.description || symptom.name,
          severity: symptom.severity || 'unknown',
          duration: symptom.duration || 'unspecified',
          effectiveDateTime: new Date()
        }

        observationRecords.push(observation)
      }

      // Create observation for overall triage assessment
      if (triageData) {
        const triageObservation = {
          id: this.generateObservationId(),
          patientId,
          encounterId,
          status: 'final',
          category: 'assessment',
          name: 'AI Triage Risk Assessment',
          value: triageData.severity || 'unknown',
          riskScore: triageData.riskScore || 0,
          recommendation: triageData.recommendedAction || 'routine_care',
          effectiveDateTime: new Date()
        }

        observationRecords.push(triageObservation)
      }

      return observationRecords

    } catch (error: any) {
      console.error('Observation record creation failed', { error: error.message })
      throw error
    }
  }

  private async storeHealthRecord(record: any): Promise<void> {
    if (!this.db) return

    try {
      // Store the health record in a summary table
      await this.db.prepare(`
        INSERT INTO health_records (id, patientId, encounterId, conditions, observations, createdAt)
        VALUES (?, ?, ?, ?, ?, ?)
      `).bind(
        this.generateHealthRecordId(),
        record.patientId,
        record.encounterId,
        JSON.stringify(record.conditions),
        JSON.stringify(record.observations),
        new Date().toISOString()
      ).run()

    } catch (error: any) {
      console.error('Failed to store health record', { error: error.message })
    }
  }

  private async storeMedicationRequest(medicationRequest: any): Promise<void> {
    if (!this.db) return

    try {
      await this.db.prepare(`
        INSERT INTO medication_requests (id, patientId, prescriptionId, status, medications, authoredOn)
        VALUES (?, ?, ?, ?, ?, ?)
      `).bind(
        medicationRequest.id,
        medicationRequest.patientId,
        medicationRequest.prescriptionId,
        medicationRequest.status,
        JSON.stringify(medicationRequest.medications),
        medicationRequest.authoredOn.toISOString()
      ).run()

    } catch (error: any) {
      console.error('Failed to store medication request', { error: error.message })
    }
  }

  private async storeComplianceRecord(record: any): Promise<void> {
    if (!this.db) return

    try {
      await this.db.prepare(`
        INSERT INTO medication_compliance (id, patientId, prescriptionId, status, recordedAt)
        VALUES (?, ?, ?, ?, ?)
      `).bind(
        this.generateComplianceId(),
        record.patientId,
        record.prescriptionId,
        record.status,
        record.recordedAt.toISOString()
      ).run()

    } catch (error) {
      console.error('Failed to store compliance record', { error: (error as any).message })
    }
  }

  private async storeInsuranceRecord(record: any): Promise<void> {
    if (!this.db) return

    try {
      await this.db.prepare(`
        INSERT INTO insurance_records (id, patientId, claimId, outcome, amount, recordedAt)
        VALUES (?, ?, ?, ?, ?, ?)
      `).bind(
        this.generateInsuranceRecordId(),
        record.patientId,
        record.claimId,
        record.outcome,
        record.amount,
        record.recordedAt.toISOString()
      ).run()

    } catch (error: any) {
      console.error('Failed to store insurance record', { error: error.message })
    }
  }

  private async storeLabRecord(record: any): Promise<void> {
    if (!this.db) return

    try {
      await this.db.prepare(`
        INSERT INTO lab_records (id, patientId, referralId, tests, status, orderedAt)
        VALUES (?, ?, ?, ?, ?, ?)
      `).bind(
        record.id,
        record.patientId,
        record.referralId,
        JSON.stringify(record.tests),
        record.status,
        record.orderedAt.toISOString()
      ).run()

    } catch (error: any) {
      console.error('Failed to store lab record', { error: error.message })
    }
  }

  private async storeLabResults(record: any): Promise<void> {
    if (!this.db) return

    try {
      await this.db.prepare(`
        INSERT INTO lab_results (id, patientId, reportId, results, abnormalFindings, completedAt)
        VALUES (?, ?, ?, ?, ?, ?)
      `).bind(
        record.id,
        record.patientId,
        record.reportId,
        JSON.stringify(record.results),
        JSON.stringify(record.abnormalFindings),
        record.completedAt.toISOString()
      ).run()

    } catch (error: any) {
      console.error('Failed to store lab results', { error: error.message })
    }
  }

  // ID Generation Methods
  private generateNigerianHealthId(phoneNumber: string): string {
    const timestamp = Date.now().toString()
    const phone = phoneNumber.replace(/\D/g, '').slice(-10)
    return `NG${phone}${timestamp.slice(-6)}`
  }

  private generatePatientId(): string {
    return `PAT_${Date.now()}_${Math.random().toString(36).substring(7).toUpperCase()}`
  }

  private generateEncounterId(): string {
    return `ENC_${Date.now()}_${Math.random().toString(36).substring(7).toUpperCase()}`
  }

  private generateConditionId(): string {
    return `COND_${Date.now()}_${Math.random().toString(36).substring(7).toUpperCase()}`
  }

  private generateObservationId(): string {
    return `OBS_${Date.now()}_${Math.random().toString(36).substring(7).toUpperCase()}`
  }

  private generateMedicationRequestId(): string {
    return `MEDREQ_${Date.now()}_${Math.random().toString(36).substring(7).toUpperCase()}`
  }

  private generateHealthRecordId(): string {
    return `HR_${Date.now()}_${Math.random().toString(36).substring(7).toUpperCase()}`
  }

  private generateComplianceId(): string {
    return `COMP_${Date.now()}_${Math.random().toString(36).substring(7).toUpperCase()}`
  }

  private generateInsuranceRecordId(): string {
    return `INS_${Date.now()}_${Math.random().toString(36).substring(7).toUpperCase()}`
  }

  private generateLabRecordId(): string {
    return `LAB_${Date.now()}_${Math.random().toString(36).substring(7).toUpperCase()}`
  }

  private generateResultsRecordId(): string {
    return `RESULT_${Date.now()}_${Math.random().toString(36).substring(7).toUpperCase()}`
  }
}