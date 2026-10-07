import { AppError } from '../auth';
export function normalizeEmail(value:unknown):string {
  if(typeof value!=='string') throw new AppError('Adresse mail obligatoire.');
  const email=value.trim().toLowerCase();
  if(email.length>254 || !/^[a-z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-z0-9](?:[a-z0-9-]*[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]*[a-z0-9])?)+$/.test(email)) throw new AppError('Adresse mail invalide.');
  return email;
}
