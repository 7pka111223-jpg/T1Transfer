export type EmergencyContact = {
  name: string
  phone: string
  relationship: string
}

export type Subscription = {
  sessionsBalance: number
  expiryDate: string
}

export type InBodyMeasurements = {
  chest: number
  waist: number
  hips: number
  arms: number
  thighs: number
}

export type InBodyEntry = {
  date: string
  weight: number
  bodyFatPercentage: number
  muscleMass: number
  measurements: InBodyMeasurements
}

export type ProgressPhoto = {
  date: string
  photoUrl: string
  notes?: string
}

export type User = {
  fullName: string
  dateOfBirth: string
  email: string
  phone: string
  gender: string
  fitnessLevel: string
  emergencyContact: EmergencyContact
  trainingGoal: string
  healthInfo: string
  injuryInfo: string
  medicalNotes?: string
  subscription: Subscription
  inbodyTracking: InBodyEntry[]
  progressPhotos: ProgressPhoto[]
}
