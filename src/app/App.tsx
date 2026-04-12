import React from 'react';
import { RouterProvider } from 'react-router';
import { router } from './routes';
import { LanguageProvider } from './context/LanguageContext';
import { CartProvider } from './context/CartContext';
import { ThemeProvider } from './context/ThemeContext';
import { AuthProvider } from './context/AuthContext';

export default function App() {
  return (
    <AuthProvider>
      <ThemeProvider>
        <LanguageProvider>
          <CartProvider>
            <RouterProvider router={router} />
          </CartProvider>
        </LanguageProvider>
      </ThemeProvider>
    </AuthProvider>
  );
}
