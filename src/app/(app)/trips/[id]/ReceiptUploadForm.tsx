'use client';

import { useState } from 'react';

export function ReceiptUploadForm({ tripId }: { tripId: number }) {
  const [status, setStatus] = useState<'idle' | 'uploading' | 'success' | 'error'>('idle');
  const [message, setMessage] = useState('');

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setStatus('uploading');
    setMessage('');

    const form = e.currentTarget;
    const formData = new FormData(form);

    try {
      const res = await fetch(`/api/trips/${tripId}/receipts`, {
        method: 'POST',
        body: formData,
      });
      const data = await res.json();
      if (!res.ok) {
        setStatus('error');
        setMessage(data.error ?? 'Upload failed.');
        return;
      }
      setStatus('success');
      setMessage('Receipt uploaded.');
      form.reset();
      window.location.reload();
    } catch {
      setStatus('error');
      setMessage('Upload failed.');
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <div>
        <label htmlFor="receipt" className="form-label">
          Upload receipt (JPEG, PNG, WebP, HEIC — max 10 MB)
        </label>
        <input
          id="receipt"
          name="receipt"
          type="file"
          accept="image/jpeg,image/png,image/webp,image/heic,image/heif,image/*"
          capture="environment"
          required
          className="form-input"
        />
      </div>
      <button
        type="submit"
        disabled={status === 'uploading'}
        className="btn btn-primary"
      >
        {status === 'uploading' ? 'Uploading…' : 'Upload receipt'}
      </button>
      {message && (
        <p className={`text-sm ${status === 'error' ? 'text-error' : 'text-success'}`}>
          {message}
        </p>
      )}
    </form>
  );
}
