import {redirect} from 'next/navigation';import {isAuthenticated} from '../../lib/auth';import LoginForm from './LoginForm';
export default async function Login(){if(await isAuthenticated())redirect('/');return <LoginForm/>}
