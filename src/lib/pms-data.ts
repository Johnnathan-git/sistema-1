import type { Account, Guest, Hotel, Reservation, Room } from './pms-types';

export const HOTEL: Hotel = {
  id: 'h1',
  name: 'Varshana Hotel',
  operationalDate: '2026-09-15',
};

export const INITIAL_ROOMS: Room[] = [
  { id: 'r01', number: 'UH 01', type: 'Apartamento', floor: 1, status: 'sujo', capacity: 2 },
  { id: 'r02', number: 'UH 02', type: 'Standard', floor: 1, status: 'livre', capacity: 2 },
  { id: 'r03', number: 'UH 03', type: 'Superior', floor: 1, status: 'limpeza', capacity: 2 },
  { id: 'r04', number: 'UH 04', type: 'Standard', floor: 1, status: 'livre', capacity: 2 },
  { id: 'r05', number: 'UH 05', type: 'Apartamento', floor: 1, status: 'livre', capacity: 3 },
  { id: 'r06', number: 'UH 06', type: 'Standard', floor: 1, status: 'interditado', capacity: 2, notes: 'Vazamento banheiro' },
  { id: 'r07', number: 'UH 07', type: 'Superior', floor: 2, status: 'ocupado', capacity: 2 },
  { id: 'r08', number: 'UH 08', type: 'Standard', floor: 2, status: 'sujo', capacity: 2 },
  { id: 'r09', number: 'UH 09', type: 'Suite', floor: 2, status: 'inspecao', capacity: 3 },
  { id: 'r10', number: 'UH 10', type: 'Standard', floor: 2, status: 'livre', capacity: 2 },
  { id: 'r11', number: 'UH 11', type: 'Chalé Master', floor: 0, status: 'livre', capacity: 4 },
  { id: 'r12', number: 'UH 12', type: 'Chalé Master', floor: 0, status: 'livre', capacity: 4 },
  { id: 'r13', number: 'UH 13', type: 'Chalé Master', floor: 0, status: 'livre', capacity: 4 },
  { id: 'r14', number: 'UH 14', type: 'Bangalô', floor: 0, status: 'manutencao', capacity: 3, notes: 'Ar-condicionado' },
  { id: 'r15', number: 'UH 15', type: 'Bangalô', floor: 0, status: 'livre', capacity: 3 },
  { id: 'r16', number: 'UH 16', type: 'Apartamento', floor: 2, status: 'ocupado', capacity: 3 },
  { id: 'r17', number: 'UH 17', type: 'Bangalô', floor: 0, status: 'sujo', capacity: 3 },
  { id: 'r18', number: 'UH 18', type: 'Superior', floor: 2, status: 'livre', capacity: 2 },
  { id: 'r19', number: 'UH 19', type: 'Standard', floor: 3, status: 'livre', capacity: 2 },
  { id: 'r20', number: 'UH 20', type: 'Suite', floor: 3, status: 'ocupado', capacity: 4 },
];

export const INITIAL_GUESTS: Guest[] = [
  { id: 'g1', name: 'Adelisiê Cristhine de Azevedo Alves Thomaz', document: '123.456.789-00', phone: '(11) 98888-1001', email: 'adelisie@email.com' },
  { id: 'g2', name: 'Alexandre Barros', document: '234.567.890-11', phone: '(11) 97777-2002' },
  { id: 'g3', name: 'Ana Maura Novak', document: '345.678.901-22', phone: '(41) 96666-3003' },
  { id: 'g4', name: 'Anisia Cristina Wilhelm', document: '456.789.012-33', phone: '(47) 95555-4004' },
  { id: 'g5', name: 'Anna Ketty Batista Salvador', document: '567.890.123-44', phone: '(21) 94444-5005' },
  { id: 'g6', name: 'Audria Dutra', document: '678.901.234-55', phone: '(48) 93333-6006' },
  { id: 'g7', name: 'Bruno Henrique Costa', document: '789.012.345-66', phone: '(11) 92222-7007' },
  { id: 'g8', name: 'Carla Mendes Oliveira', document: '890.123.456-77', phone: '(31) 91111-8008' },
];

export const INITIAL_RESERVATIONS: Reservation[] = [
  {
    id: 'res1', code: 'RSV-1001', guestId: 'g1', guestName: 'Adelisiê Cristhine de Azevedo Alves Thomaz',
    roomId: 'r11', roomNumber: 'UH 11', roomType: 'Chalé Master',
    checkIn: '2026-09-15', checkOut: '2026-09-16', adults: 2, children: 0,
    status: 'confirmada', origin: 'booking', totalAmount: 890, paidAmount: 0, fnrhFilled: false,
  },
  {
    id: 'res2', code: 'RSV-1002', guestId: 'g2', guestName: 'Alexandre Barros',
    roomId: 'r13', roomNumber: 'UH 13', roomType: 'Chalé Master',
    checkIn: '2026-09-15', checkOut: '2026-09-16', adults: 2, children: 1,
    status: 'confirmada', origin: 'direto', totalAmount: 950, paidAmount: 950, fnrhFilled: true,
  },
  {
    id: 'res3', code: 'RSV-1003', guestId: 'g3', guestName: 'Ana Maura Novak',
    roomId: 'r17', roomNumber: 'UH 17', roomType: 'Bangalô',
    checkIn: '2026-09-15', checkOut: '2026-09-17', adults: 2, children: 0,
    status: 'confirmada', origin: 'expedia', totalAmount: 1200, paidAmount: 1200, fnrhFilled: true,
  },
  {
    id: 'res4', code: 'RSV-1004', guestId: 'g4', guestName: 'Anisia Cristina Wilhelm',
    roomId: 'r05', roomNumber: 'UH 05', roomType: 'Apartamento',
    checkIn: '2026-09-15', checkOut: '2026-09-17', adults: 2, children: 0,
    status: 'confirmada', origin: 'telefone', totalAmount: 680, paidAmount: 680, fnrhFilled: false,
  },
  {
    id: 'res5', code: 'RSV-1005', guestId: 'g5', guestName: 'Anna Ketty Batista Salvador',
    roomId: 'r01', roomNumber: 'UH 01', roomType: 'Apartamento',
    checkIn: '2026-09-15', checkOut: '2026-09-16', adults: 1, children: 0,
    status: 'confirmada', origin: 'booking', totalAmount: 420, paidAmount: 420, fnrhFilled: true,
  },
  {
    id: 'res6', code: 'RSV-1006', guestId: 'g6', guestName: 'Audria Dutra',
    roomId: 'r12', roomNumber: 'UH 12', roomType: 'Chalé Master',
    checkIn: '2026-09-15', checkOut: '2026-09-16', adults: 2, children: 2,
    status: 'confirmada', origin: 'direto', totalAmount: 1100, paidAmount: 1100, fnrhFilled: true,
  },
  {
    id: 'res7', code: 'RSV-1007', guestId: 'g7', guestName: 'Bruno Henrique Costa',
    roomId: 'r07', roomNumber: 'UH 07', roomType: 'Superior',
    checkIn: '2026-09-14', checkOut: '2026-09-16', adults: 2, children: 0,
    status: 'checkin', origin: 'walkin', totalAmount: 760, paidAmount: 400, fnrhFilled: true, accountId: 'acc1',
  },
  {
    id: 'res8', code: 'RSV-1008', guestId: 'g8', guestName: 'Carla Mendes Oliveira',
    roomId: 'r16', roomNumber: 'UH 16', roomType: 'Apartamento',
    checkIn: '2026-09-13', checkOut: '2026-09-15', adults: 2, children: 1,
    status: 'checkin', origin: 'booking', totalAmount: 980, paidAmount: 980, fnrhFilled: true, accountId: 'acc2',
  },
  {
    id: 'res9', code: 'RSV-1009', guestId: 'g1', guestName: 'Adelisiê Cristhine de Azevedo Alves Thomaz',
    roomType: 'Suite', checkIn: '2026-09-20', checkOut: '2026-09-23', adults: 2, children: 0,
    status: 'confirmada', origin: 'direto', totalAmount: 2100, paidAmount: 500, fnrhFilled: false,
  },
  {
    id: 'res10', code: 'RSV-1010', guestId: 'g2', guestName: 'Alexandre Barros',
    roomType: 'Standard', checkIn: '2026-09-18', checkOut: '2026-09-19', adults: 1, children: 0,
    status: 'pendente', origin: 'telefone', totalAmount: 320, paidAmount: 0, fnrhFilled: false,
  },
];

export const INITIAL_ACCOUNTS: Account[] = [
  {
    id: 'acc1', type: 'hospede', guestId: 'g7', guestName: 'Bruno Henrique Costa',
    reservationId: 'res7', roomId: 'r07', status: 'parcial',
    openedAt: '2026-09-14',
    charges: [
      { id: 'c1', description: 'Diária Superior', amount: 380, date: '2026-09-14', category: 'hospedagem' },
      { id: 'c2', description: 'Diária Superior', amount: 380, date: '2026-09-15', category: 'hospedagem' },
      { id: 'c3', description: 'Frigobar', amount: 45, date: '2026-09-14', category: 'consumo' },
    ],
    payments: [
      { id: 'p1', amount: 400, method: 'PIX', date: '2026-09-14' },
    ],
  },
  {
    id: 'acc2', type: 'hospede', guestId: 'g8', guestName: 'Carla Mendes Oliveira',
    reservationId: 'res8', roomId: 'r16', status: 'quitada',
    openedAt: '2026-09-13',
    charges: [
      { id: 'c4', description: 'Diária Apartamento x2', amount: 900, date: '2026-09-13', category: 'hospedagem' },
      { id: 'c5', description: 'Lavanderia', amount: 80, date: '2026-09-14', category: 'servico' },
    ],
    payments: [
      { id: 'p2', amount: 980, method: 'Cartão', date: '2026-09-13' },
    ],
  },
  {
    id: 'acc3', type: 'avulsa', guestName: 'Evento Empresa XYZ',
    status: 'aberta', openedAt: '2026-09-15',
    charges: [
      { id: 'c6', description: 'Salão de eventos — 4h', amount: 1500, date: '2026-09-15', category: 'servico' },
      { id: 'c7', description: 'Coffee break 20 pax', amount: 600, date: '2026-09-15', category: 'consumo' },
    ],
    payments: [],
  },
  {
    id: 'acc4', type: 'avulsa', guestName: 'João da Silva — day use',
    status: 'quitada', openedAt: '2026-09-12',
    charges: [
      { id: 'c8', description: 'Day use piscina', amount: 120, date: '2026-09-12', category: 'servico' },
    ],
    payments: [
      { id: 'p3', amount: 120, method: 'Dinheiro', date: '2026-09-12' },
    ],
  },
];
