// Gruppenkurse mit Teilnehmerliste.
//
// Jede Teilnahme ist eine Einnahme über den Kurspreis (Buchung mit courseId).
// Standardmäßig "noch offen" – so funktionieren Abhaken, Erinnerung nach
// 14 Tagen und Rechnung/Quittung wie bei allen anderen Einnahmen.

import {
  state, uid, nowISO, saveRecord, deleteRecord, recordById, saveBooking, deleteBooking, saveContact, contactById,
} from './data.js';
import { todayISO } from './format.js';

export function coursesSorted() {
  return [...state.courses].sort((a, b) => (a.startDate !== b.startDate ? (a.startDate < b.startDate ? 1 : -1) : (a.name < b.name ? -1 : 1)));
}

export function participantBooking(p) {
  return state.bookings.find((b) => b.id === p.bookingId) || null;
}

/** 'open' | 'paid' | 'missing' (Buchung gelöscht) */
export function participantStatus(p) {
  const b = participantBooking(p);
  if (!b) return 'missing';
  return b.paid === false ? 'open' : 'paid';
}

export function courseStats(course) {
  let paid = 0;
  let open = 0;
  let openCents = 0;
  let paidCents = 0;
  for (const p of course.participants || []) {
    const b = participantBooking(p);
    if (!b) continue;
    if (b.paid === false) { open += 1; openCents += b.amountCents; } else { paid += 1; paidCents += b.amountCents; }
  }
  return { count: (course.participants || []).length, paid, open, openCents, paidCents };
}

export function isFull(course) {
  return course.maxParticipants > 0 && (course.participants || []).length >= course.maxParticipants;
}

export async function saveCourse(input) {
  return saveRecord('courses', { participants: [], finished: false, ...input });
}

/** Kurs kopieren (z. B. nächster Welpenkurs) – ohne Teilnehmer:innen */
export async function duplicateCourse(course) {
  const { id, participants, createdAt, updatedAt, order, finished, ...rest } = course;
  return saveRecord('courses', { ...rest, name: `${course.name} (Kopie)`, startDate: todayISO(), participants: [], finished: false });
}

export async function deleteCourse(course) {
  if ((course.participants || []).length) throw new Error('Der Kurs hat noch Teilnehmer:innen.');
  await deleteRecord('courses', course.id);
}

/**
 * Teilnehmer:in hinzufügen: legt die Einnahme über den Kurspreis an.
 * payment: null = noch offen, 'cash' | 'transfer' = schon bezahlt (heute)
 */
export async function addParticipant(course, { personId = null, newName = null, payment = null }) {
  let pid = personId;
  if (!pid && newName) pid = (await saveContact({ name: newName }, { silent: true })).id;
  if (!pid) throw new Error('Bitte eine Kund:in wählen.');
  if ((course.participants || []).some((p) => p.personId === pid)) {
    throw new Error(`${contactById(pid)?.name || 'Diese Kund:in'} ist schon im Kurs.`);
  }
  const paid = !!payment;
  const booking = await saveBooking({
    type: 'income',
    categoryId: course.categoryId,
    amountCents: course.priceCents,
    description: course.name,
    personId: pid,
    courseId: course.id,
    paid,
    payment: paid ? payment : null,
    date: paid ? todayISO() : course.startDate,
    serviceDate: course.startDate,
  });
  const participant = { id: uid('tn'), personId: pid, bookingId: booking.id, addedAt: nowISO() };
  const current = recordById('courses', course.id) || course;
  await saveRecord('courses', { id: course.id, participants: [...(current.participants || []), participant] });
  return participant;
}

/**
 * Teilnehmer:in entfernen. Unbezahlt: die offene Einnahme wird gelöscht.
 * Bezahlt: die Einnahme bleibt (das Geld ist ja da) und wird nur vom Kurs gelöst.
 */
export async function removeParticipant(course, participantId) {
  const current = recordById('courses', course.id) || course;
  const p = (current.participants || []).find((x) => x.id === participantId);
  if (!p) return;
  const b = participantBooking(p);
  if (b && b.paid === false) await deleteBooking(b.id);
  else if (b) await saveBooking({ id: b.id, courseId: null });
  await saveRecord('courses', { id: current.id, participants: (current.participants || []).filter((x) => x.id !== participantId) });
}

/** Wird eine Kurs-Buchung gelöscht, verschwindet auch die Teilnahme */
export async function detachBooking(booking) {
  if (!booking?.courseId) return;
  const course = recordById('courses', booking.courseId);
  if (!course) return;
  const rest = (course.participants || []).filter((p) => p.bookingId !== booking.id);
  if (rest.length !== (course.participants || []).length) await saveRecord('courses', { id: course.id, participants: rest });
}

/** Kurse einer Kund:in */
export function coursesOf(personId) {
  return state.courses.filter((c) => (c.participants || []).some((p) => p.personId === personId));
}
