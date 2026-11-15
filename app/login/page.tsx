'use client';

import { FormEvent, useState } from 'react';

export default function Home() {
  const [showPassword, setShowPassword] = useState(false);
  const [notice, setNotice] = useState('');

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setNotice('Enter your email and password to continue.');
  }

  return (
    <main className="auth-scene">
      <div className="art art-left" aria-hidden="true"><span /><span /><span /><span /><span /><span /><span /><span /><span /></div>
      <div className="art art-right" aria-hidden="true"><span /><span /><span /></div>
      <section className="auth-panel" aria-label="Sign in">
        <div className="auth-content">
          <div className="brand" aria-label="SignalBoard">
            <span>signal</span><i>∞</i><span>board</span>
          </div>
          <h1>How do you want to log in?</h1>
          <div className="provider-row">
            <button className="provider" type="button" onClick={() => setNotice('Google sign in is not configured in this demo.')}><b className="google">G</b>Google</button>
            <button className="provider" type="button" onClick={() => setNotice('Facebook sign in is not configured in this demo.')}><b className="facebook">f</b>Facebook</button>
          </div>
          <div className="divider"><span /> <em>or</em> <span /></div>
          <form onSubmit={submit} noValidate>
            <label htmlFor="email">E-mail *</label>
            <input id="email" name="email" type="email" placeholder="Enter your email" />
            <label htmlFor="password">Password *</label>
            <div className="password-wrap">
              <input id="password" name="password" type={showPassword ? 'text' : 'password'} placeholder="Write your password here" />
              <button type="button" className="show-password" onClick={() => setShowPassword(!showPassword)} aria-label={showPassword ? 'Hide password' : 'Show password'}>{showPassword ? '◉' : '◌̸'}</button>
            </div>
            <button className="forgot" type="button" onClick={() => setNotice('Password recovery is not configured in this demo.')}>I forgot my password</button>
            <button className="access" type="submit">Access</button>
            <p className="register">Not registered yet? <button type="button" onClick={() => setNotice('Account creation is not configured in this demo.')}>Create an account</button></p>
            <p className="notice" role="status">{notice}</p>
          </form>
        </div>
      </section>
    </main>
  );
}
