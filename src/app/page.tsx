import { redirect } from 'next/navigation';

export default function HomePage() {
  // Automatically send users to the login screen
  redirect('/login');
}
