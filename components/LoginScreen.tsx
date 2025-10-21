import React, { useState } from 'react';
import { Logo } from './Logo';
import { GoogleIcon, MailIcon, LockClosedIcon } from './Icons';

interface LoginScreenProps {
  onLogin: () => void;
}

const LoginScreen: React.FC<LoginScreenProps> = ({ onLogin }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isSignUp, setIsSignUp] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const handleLoginAttempt = () => {
    setIsLoading(true);
    // Simulate a network request for a more realistic feel
    setTimeout(() => {
      onLogin();
      // No need to set isLoading(false) as the component will unmount
    }, 1500);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    handleLoginAttempt();
  };

  return (
    <div className="min-h-screen bg-gray-900 text-gray-100 flex flex-col justify-center items-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <Logo className="w-16 h-16 mx-auto mb-4" />
          <h1 className="text-3xl font-bold tracking-wider text-white">AURA LOFI</h1>
          <p className="text-gray-400 mt-2">AI Image Generator and Editor</p>
        </div>

        <div className="bg-gray-800 p-8 rounded-2xl shadow-2xl space-y-6">
          <h2 className="text-2xl font-semibold text-center text-white">{isSignUp ? 'Create an Account' : 'Welcome Back'}</h2>
          
          <button
            onClick={handleLoginAttempt}
            disabled={isLoading}
            className="w-full flex items-center justify-center gap-3 py-3 px-4 bg-white text-gray-800 font-semibold rounded-lg hover:bg-gray-200 transition-colors disabled:opacity-70 disabled:cursor-not-allowed"
          >
            <GoogleIcon className="w-6 h-6" />
            Continue with Google
          </button>

          <div className="flex items-center space-x-2">
            <hr className="flex-grow border-gray-600" />
            <span className="text-gray-400 text-sm">OR</span>
            <hr className="flex-grow border-gray-600" />
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label htmlFor="email" className="sr-only">Email</label>
              <div className="relative">
                 <MailIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                 <input
                  id="email"
                  type="email"
                  placeholder="Email address"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  disabled={isLoading}
                  className="w-full bg-gray-700 border border-gray-600 rounded-lg pl-10 pr-4 py-3 text-sm text-gray-100 placeholder-gray-400 focus:bg-gray-700 focus:border-purple-500 focus:ring-2 focus:ring-purple-500 outline-none transition-all disabled:opacity-70"
                />
              </div>
            </div>
            <div>
              <label htmlFor="password" className="sr-only">Password</label>
              <div className="relative">
                 <LockClosedIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                <input
                  id="password"
                  type="password"
                  placeholder="Password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  minLength={6}
                  disabled={isLoading}
                  className="w-full bg-gray-700 border border-gray-600 rounded-lg pl-10 pr-4 py-3 text-sm text-gray-100 placeholder-gray-400 focus:bg-gray-700 focus:border-purple-500 focus:ring-2 focus:ring-purple-500 outline-none transition-all disabled:opacity-70"
                />
              </div>
            </div>
            <button
              type="submit"
              disabled={isLoading}
              className="w-full py-3 px-4 bg-purple-600 hover:bg-purple-700 font-semibold rounded-lg transition-colors flex items-center justify-center disabled:bg-purple-800 disabled:cursor-wait"
            >
              {isLoading ? (
                <>
                  <div className="w-5 h-5 border-2 border-white/50 border-t-white rounded-full animate-spin mr-2"></div>
                  <span>Please wait...</span>
                </>
              ) : (
                isSignUp ? 'Sign Up' : 'Log In'
              )}
            </button>
          </form>

          <div className="text-center text-sm">
            <button onClick={() => setIsSignUp(!isSignUp)} className="text-purple-400 hover:text-purple-300 disabled:opacity-70 disabled:cursor-not-allowed" disabled={isLoading}>
              {isSignUp ? 'Already have an account? Log In' : "Don't have an account? Sign Up"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default LoginScreen;
