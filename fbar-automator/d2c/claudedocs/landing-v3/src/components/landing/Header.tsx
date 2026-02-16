import React, { useState } from 'react';
import { MenuIcon, XIcon, FlagIcon } from 'lucide-react';
export function Header() {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  return (
    <>
      {/* USWDS-style Official Site Banner */}
      <div className="w-full bg-gov-blue-dark py-1 px-4">
        <div className="max-w-doc mx-auto flex items-center">
          <FlagIcon className="h-3 w-3 text-gray-400 mr-2" />
          <span className="text-xs text-gray-300">
            FBAR Direct is not a government website.{' '}
            <a href="#" className="underline hover:text-white">
              Learn more about our FinCEN registration.
            </a>
          </span>
        </div>
      </div>

      <header className="w-full bg-white border-b border-border-gray relative z-40">
        <div className="max-w-doc mx-auto px-4 h-auto md:h-24 flex items-center justify-between py-4 md:py-0">
          {/* Logo Area - Left Aligned */}
          <div className="flex flex-col items-start">
            <a
              href="/"
              className="font-heading font-bold text-2xl text-gov-blue leading-tight mb-1">

              FBAR Direct
            </a>
            <span className="text-xs text-text-secondary">
              FinCEN-Registered BSA E-Filing Institution
            </span>
          </div>

          {/* Desktop Navigation */}
          <nav className="hidden md:flex items-center space-x-6">
            <a
              href="#who-must-file"
              className="text-gov-blue text-sm font-semibold hover:underline">

              Who Must File
            </a>
            <a
              href="#how-to-file"
              className="text-gov-blue text-sm font-semibold hover:underline">

              How to File
            </a>
            <a
              href="#pricing"
              className="text-gov-blue text-sm font-semibold hover:underline">

              Pricing
            </a>
            <a
              href="#faq"
              className="text-gov-blue text-sm font-semibold hover:underline">

              FAQ
            </a>
            <a
              href="#"
              className="text-gov-blue text-sm font-semibold hover:underline ml-4">

              Log In
            </a>

            <a
              href="#"
              className="bg-gov-blue hover:bg-gov-blue-dark text-white font-semibold text-sm px-4 py-2 transition-colors ml-4">

              Begin Filing
            </a>
          </nav>

          {/* Mobile Menu Button */}
          <button
            className="md:hidden text-gov-blue p-2"
            onClick={() => setIsMenuOpen(!isMenuOpen)}
            aria-label="Toggle menu">

            {isMenuOpen ?
            <XIcon className="h-6 w-6" /> :

            <MenuIcon className="h-6 w-6" />
            }
          </button>
        </div>

        {/* Mobile Navigation */}
        {isMenuOpen &&
        <div className="md:hidden absolute top-full left-0 w-full bg-white border-b border-border-gray shadow-lg py-4 px-4 flex flex-col space-y-4">
            <a
            href="#who-must-file"
            className="text-gov-blue text-sm font-semibold py-2 border-b border-gray-100"
            onClick={() => setIsMenuOpen(false)}>

              Who Must File
            </a>
            <a
            href="#how-to-file"
            className="text-gov-blue text-sm font-semibold py-2 border-b border-gray-100"
            onClick={() => setIsMenuOpen(false)}>

              How to File
            </a>
            <a
            href="#pricing"
            className="text-gov-blue text-sm font-semibold py-2 border-b border-gray-100"
            onClick={() => setIsMenuOpen(false)}>

              Pricing
            </a>
            <a
            href="#faq"
            className="text-gov-blue text-sm font-semibold py-2 border-b border-gray-100"
            onClick={() => setIsMenuOpen(false)}>

              FAQ
            </a>
            <a
            href="#"
            className="text-gov-blue text-sm font-semibold py-2 border-b border-gray-100"
            onClick={() => setIsMenuOpen(false)}>

              Log In
            </a>
            <a
            href="#"
            className="bg-gov-blue hover:bg-gov-blue-dark text-white font-semibold text-sm px-4 py-3 text-center w-full block mt-2"
            onClick={() => setIsMenuOpen(false)}>

              Begin Filing
            </a>
          </div>
        }
      </header>
    </>);

}