import type { Account, Guest, Hotel, Reservation, Room } from './pms-types';

export const HOTEL: Hotel = {
  id: 'h1',
  name: 'Varshana Hotel',
  operationalDate: '2026-09-15',
};

export const INITIAL_ROOMS: Room[] = [
  { id: 'r01', number: 'UH 01', type: 'Apartamento', floor: 1, block: 'Torre A', capacity: 2, occupancy: 'livre', governance: 'sujo', housekeeper: 'Maria Silva' },
  { id: 'r02', number: 'UH 02', type: 'Standard', floor: 1, block: 'Torre A', capacity: 2, occupancy: 'livre', governance: 'limpo', housekeeper: 'Maria Silva' },
  { id: 'r03', number: 'UH 03', type: 'Superior', floor: 1, block: 'Torre A', capacity: 2, occupancy: 'livre', governance: 'limpeza', housekeeper: 'Ana Costa' },
  { id: 'r04', number: 'UH 04', type: 'Standard', floor: 1, block: 'Torre A', capacity: 2, occupancy: 'livre', governance: 'limpo' },
  { id: 'r05', number: 'UH 05', type: 'Apartamento', floor: 1, block: 'Torre A', capacity: 3, occupancy: 'livre', governance: 'limpo', housekeeper: 'Ana Costa' },
  { id: 'r06', number: 'UH 06', type: 'Standard', floor: 1, block: 'Torre A', capacity: 2, occupancy: 'bloqueado', governance: 'interditado', notes: 'Vazamento banheiro', blockedReason: 'Vazamento banheiro' },
  { id: 'r07', number: 'UH 07', type: 'Superior', floor: 2, block: 'Torre A', capacity: 2, occupancy: 'ocupado', governance: 'limpo', housekeeper: 'Joana Pereira' },
  { id: 'r08', number: 'UH 08', type: 'Standard', floor: 2, block: 'Torre A', capacity: 2, occupancy: 'livre', governance: 'sujo', housekeeper: 'Joana Pereira' },
  { id: 'r09', number: 'UH 09', type: 'Suite', floor: 2, block: 'Torre B', capacity: 3, occupancy: 'livre', governance: 'inspecao', housekeeper: 'Fernanda Lima' },
  { id: 'r10', number: 'UH 10', type: 'Standard', floor: 2, block: 'Torre B', capacity: 2, occupancy: 'livre', governance: 'limpo' },
  { id: 'r11', number: 'UH 11', type: 'Chalé Master', floor: 0, block: 'Chalés', capacity: 4, occupancy: 'livre', governance: 'limpo', housekeeper: 'Patrícia Souza' },
  { id: 'r12', number: 'UH 12', type: 'Chalé Master', floor: 0, block: 'Chalés', capacity: 4, occupancy: 'livre', governance: 'limpo', housekeeper: 'Patrícia Souza' },
  { id: 'r13', number: 'UH 13', type: 'Chalé Master', floor: 0, block: 'Chalés', capacity: 4, occupancy: 'livre', governance: 'limpo' },
  { id: 'r14', number: 'UH 14', type: 'Bangalô', floor: 0, block: 'Chalés', capacity: 3, occupancy: 'bloqueado', governance: 'manutencao', notes: 'Ar-condicionado', blockedReason: 'Ar-condicionado' },
  { id: 'r15', number: 'UH 15', type: 'Bangalô', floor: 0, block: 'Chalés', capacity: 3, occupancy: 'livre', governance: 'limpo' },
  { id: 'r16', number: 'UH 16', type: 'Apartamento', floor: 2, block: 'Torre B', capacity: 3, occupancy: 'livre', governance: 'limpo', housekeeper: 'Fernanda Lima' },
  { id: 'r17', number: 'UH 17', type: 'Bangalô', floor: 0, block: 'Chalés', capacity: 3, occupancy: 'livre', governance: 'sujo', housekeeper: 'Patrícia Souza' },
  { id: 'r18', number: 'UH 18', type: 'Superior', floor: 2, block: 'Torre B', capacity: 2, occupancy: 'livre', governance: 'limpo' },
  { id: 'r19', number: 'UH 19', type: 'Standard', floor: 3, block: 'Torre B', capacity: 2, occupancy: 'livre', governance: 'limpo' },
  { id: 'r20', number: 'UH 20', type: 'Suite', floor: 3, block: 'Torre B', capacity: 4, occupancy: 'livre', governance: 'limpo', housekeeper: 'Maria Silva' },
];

export const INITIAL_GUESTS: Guest[] = [
  {
    id: 'g1',
    name: 'Ana Maura Novak',
    document: '345.678.901-22',
    phone: '(41) 96666-3003',
    email: 'ana.novak@email.com',
  },
  {
    id: 'g2',
    name: 'Bruno Henrique Costa',
    document: '789.012.345-66',
    phone: '(11) 92222-7007',
    email: 'bruno.costa@email.com',
  },
];

/** Apenas 2 reservas de desenvolvimento */
export const INITIAL_RESERVATIONS: Reservation[] = [
  {
    id: 'res1',
    code: 'RSV-1001',
    guestId: 'g1',
    guestName: 'Ana Maura Novak',
    roomId: 'r11',
    roomNumber: 'UH 11',
    roomType: 'Chalé Master',
    checkIn: '2026-09-15',
    checkOut: '2026-09-17',
    adults: 2,
    children: 0,
    status: 'confirmada',
    origin: 'booking',
    totalAmount: 1200,
    paidAmount: 600,
    fnrhFilled: true,
    notes: 'Chegada prevista à tarde',
  },
  {
    id: 'res2',
    code: 'RSV-1002',
    guestId: 'g2',
    guestName: 'Bruno Henrique Costa',
    roomId: 'r07',
    roomNumber: 'UH 07',
    roomType: 'Superior',
    checkIn: '2026-09-14',
    checkOut: '2026-09-16',
    adults: 2,
    children: 0,
    status: 'checkin',
    origin: 'direto',
    totalAmount: 760,
    paidAmount: 400,
    fnrhFilled: true,
    accountId: 'acc1',
    notes: 'Hóspede já na casa',
  },
];

export const INITIAL_ACCOUNTS: Account[] = [
  {
    id: 'acc1',
    type: 'hospede',
    guestId: 'g2',
    guestName: 'Bruno Henrique Costa',
    reservationId: 'res2',
    roomId: 'r07',
    status: 'parcial',
    openedAt: '2026-09-14',
    charges: [
      { id: 'c1', description: 'Diária Superior', amount: 380, date: '2026-09-14', category: 'hospedagem' },
      { id: 'c2', description: 'Diária Superior', amount: 380, date: '2026-09-15', category: 'hospedagem' },
      { id: 'c3', description: 'Frigobar', amount: 45, date: '2026-09-14', category: 'consumo' },
      { id: 'c4', description: 'Lavanderia', amount: 35, date: '2026-09-15', category: 'servico' },
    ],
    payments: [
      { id: 'p1', amount: 400, method: 'PIX', date: '2026-09-14' },
    ],
  },
];
