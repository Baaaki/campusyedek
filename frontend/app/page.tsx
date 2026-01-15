import { redirect } from 'next/navigation';

export default function HomePage() {
  // Ana sayfa doğrudan dashboard'a yönlendirir
  redirect('/dashboard');
}