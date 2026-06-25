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

export type OpenHour = {
  dayOfWeek: number | null;
  openingTime: string | null;
  closingTime: string | null;
  isOpen: boolean | null;
};

export type CompanyConfig = {
  companyName: string;
  companyDescription: string | null;
  openHours: OpenHour[];
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
