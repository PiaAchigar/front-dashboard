export type Provider = {
  id: string;
  fullName: string | null;
  specialties: string | null;
};

export type ProviderAdmin = {
  id: string;
  fullName: string | null;
  email: string | null;
  phone: string | null;
  dni: string | null;
  cuit: string | null;
  specialties: string | null;
  notes: string | null;
  address: string | null;
  postalCode: string | null;
  status: string | null;
};

export type ProviderService = {
  id: string;
  name: string | null;
  estimatedDurationMinutes: number | null;
  unitPriceList: number | null;
  unitPriceCash: number | null;
};

export type Service = {
  id: string;
  name: string | null;
  description: string | null;
  code: string | null;
  unitPriceList: number | null;
  unitPriceCash: number | null;
  taxCategory: string | null;
  requiresOperator: boolean | null;
  requiresMachine: boolean | null;
  estimatedDurationMinutes: number | null;
  unitType: string | null;
  isActive: boolean | null;
  isFeatured: boolean | null;
  isVisible: boolean | null;
  webSortOrder: number | null;
  categories: { id: string; name: string | null }[];
  primaryMachine?: { id: string; name: string | null } | null;
};

export type Machine = {
  id: string;
  name: string | null;
  description: string | null;
  equipmentType: string | null;
  requiresOperator: boolean | null;
  hourlyCost: number | null;
  status: string | null;
  purchaseDate: string | null;
  weightKg: number | null;
  dimensions: string | null;
  quantity: number | null;
  maintenanceCount: number | null;
  lastMaintenanceAt: string | null;
  maintenanceNotes: string | null;
  supplierInfo: string | null;
  warrantyCost: number | null;
  warrantyExpiry: string | null;
};

export type MaintenanceLog = {
  id: string;
  machineId: string | null;
  maintenanceDate: string | null;
  maintenanceType: string | null;
  description: string | null;
  cost: number | null;
  performedBy: string | null;
  notes: string | null;
  createdAt: string | null;
};

export type CategoryNode = {
  id: string;
  name: string | null;
  description: string | null;
  displayOrder: number | null;
  isActive: boolean | null;
  children: CategoryNode[];
};

export type Promotion = {
  id: string;
  name: string | null;
  description: string | null;
  promotionType: string | null;
  validFrom: string | null;
  validUntil: string | null;
  isFeatured: boolean | null;
  services: { id: string; name: string | null; unitPriceList: number | null }[];
};

// Acuerdo vigente proveedora↔servicio (service_provider_service)
export type ServiceAgreement = {
  serviceProviderId: string;
  providerName: string | null;
  paymentType: string | null; // per_hour | percentage | fixed_per_service
  rate: number | null;
};

// ── Promos en Administración (CRUD con líneas servicio/proveedora/pago + snapshot) ──
export type PromoLineAdmin = {
  id: string;
  serviceId: string | null;
  serviceName: string | null;
  serviceProviderId: string | null;
  serviceProviderName: string | null;
  servicePrice: number | null;
  providerPayment: number | null;
};

export type PromotionAdmin = {
  id: string;
  name: string | null;
  description: string | null;
  promotionType: string | null; // 'percentage' | 'fixed_amount'
  discountPercentage: number | null;
  discountAmount: number | null;
  servicesSubtotal: number | null;
  finalAmount: number | null;
  validFrom: string | null;
  validUntil: string | null;
  status: string | null; // active | inactive
  isFeatured: boolean | null;
  usageLimit: number | null;
  notes: string | null;
  lines: PromoLineAdmin[];
};

export type OpenHour = {
  dayOfWeek: number | null;
  openingTime: string | null;
  closingTime: string | null;
  isOpen: boolean | null;
};

export type CompanyConfig = {
  companyName: string;
  companyDescription: string | null;
  heroTitle: string | null;
  heroSubtitle: string | null;
  aboutUs: string | null;
  address: string | null;
  phone: string | null;
  email: string | null;
  website: string | null;
  instagram: string | null;
  facebook: string | null;
  whatsapp: string | null;
  openHours: OpenHour[];
};

export type Training = {
  id: string;
  name: string | null;
  description: string | null;
  modality: string | null;
  location: string | null;
  listPrice: number | null;
  cashPrice: number | null;
  isVisible: boolean | null;
  isFeatured: boolean | null;
  webSortOrder: number | null;
};

export type WebGalleryItem = {
  id: string;
  r2Path: string | null;
  publicUrl: string | null;
  alt: string | null;
  caption: string | null;
  sortOrder: number | null;
  isVisible: boolean | null;
  createdAt: string | null;
};

export type WebTestimonial = {
  id: string;
  authorName: string | null;
  body: string | null;
  rating: number | null;
  isVisible: boolean | null;
  createdAt: string | null;
};

export type Faq = {
  id: string;
  question: string | null;
  answer: string | null;
  category: string | null;
  isActive: boolean | null;
  displayOrder: number | null;
  keywords: string[] | null;
  createdAt: string | null;
  updatedAt: string | null;
};

export type MpAccount = {
  id: string;
  serviceProviderId: string | null;
  accountOwnerName: string | null;
  accountEmail: string | null;
  alias: string | null;
  cvu: string | null;
  status: string | null;
  createdAt: string | null;
};

export type AdminUser = {
  id: string;
  email: string | null;
  role: string | null;
  createdAt: string | null;
  lastSignInAt: string | null;
};

export type Customer = {
  id: string;
  contactId: string | null;
  dni: string | null;
  cuit: string | null;
  name: string | null;
  phone: string | null;
  email: string | null;
};

export type AppointmentStatus = "scheduled" | "completed" | "cancelled" | "no_show";

export type Appointment = {
  id: string;
  appointmentStart: string;
  appointmentEnd: string;
  durationMinutes: number | null;
  servicePrice: number | null;
  status: AppointmentStatus;
  notes: string | null;
  providerPaymentType: string | null;
  providerRate: string | null;
  providerEarning: string | null;
  customerId: string | null;
  customerName: string | null;
  customerPhone: string | null;
  serviceId: string | null;
  serviceName: string | null;
  providerId: string | null;
  providerName: string | null;
  machineId: string | null;
  machineName: string | null;
};
