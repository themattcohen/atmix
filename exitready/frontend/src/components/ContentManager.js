import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import { 
  Edit3, 
  Save, 
  Eye,
  EyeOff,
  Home,
  FileText,
  Monitor,
  Settings as SettingsIcon
} from 'lucide-react';
import { siteContent } from '../content/siteContent';

const ContentManager = () => {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [activeTab, setActiveTab] = useState('landing');
  const [content, setContent] = useState(siteContent);
  const [password, setPassword] = useState('');

  const ADMIN_PASSWORD = "exitready2024";

  const handleLogin = (e) => {
    e.preventDefault();
    if (password === ADMIN_PASSWORD) {
      setIsAuthenticated(true);
    } else {
      alert('Invalid password');
    }
  };

  const updateContent = (path, value) => {
    const keys = path.split('.');
    const newContent = { ...content };
    let current = newContent;
    
    for (let i = 0; i < keys.length - 1; i++) {
      current = current[keys[i]];
    }
    current[keys[keys.length - 1]] = value;
    
    setContent(newContent);
  };

  const saveContent = () => {
    // In production, this would save to your backend/database
    console.log('Content saved:', content);
    
    // For now, create a downloadable JSON file
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(content, null, 2));
    const downloadAnchorNode = document.createElement('a');
    downloadAnchorNode.setAttribute("href", dataStr);
    downloadAnchorNode.setAttribute("download", "siteContent.json");
    document.body.appendChild(downloadAnchorNode);
    downloadAnchorNode.click();
    downloadAnchorNode.remove();
    
    alert('Content saved! JSON file downloaded. In production, this would update your website automatically.');
  };

  const TextEditor = ({ label, value, path, multiline = false }) => {
    const Component = multiline ? 'textarea' : 'input';
    return (
      <div className="mb-6">
        <label className="block text-sm font-semibold mb-2 text-gray-300">{label}</label>
        <Component
          type={multiline ? undefined : "text"}
          value={value || ''}
          onChange={(e) => updateContent(path, e.target.value)}
          rows={multiline ? 4 : undefined}
          className={`w-full bg-slate-800 border border-gray-600 rounded-lg px-4 py-3 text-white placeholder-gray-400 focus:border-blue-400 focus:outline-none transition-colors ${multiline ? 'resize-vertical' : ''}`}
        />
      </div>
    );
  };

  const ArrayEditor = ({ label, items, path }) => {
    const updateItem = (index, field, value) => {
      const newItems = [...items];
      newItems[index] = { ...newItems[index], [field]: value };
      updateContent(path, newItems);
    };

    return (
      <div className="mb-8">
        <h3 className="text-lg font-semibold mb-4 text-gray-300">{label}</h3>
        {items?.map((item, index) => (
          <div key={index} className="bg-slate-800/50 rounded-lg p-4 mb-4">
            <div className="text-sm text-blue-400 mb-2">Item {index + 1}</div>
            <TextEditor
              label="Title"
              value={item.title}
              path={`${path}.${index}.title`}
            />
            <TextEditor
              label="Description"
              value={item.description}
              path={`${path}.${index}.description`}
              multiline={true}
            />
          </div>
        ))}
      </div>
    );
  };

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen gradient-bg flex items-center justify-center">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8 }}
          className="glass-effect rounded-3xl p-8 w-full max-w-md"
        >
          <div className="text-center mb-8">
            <div className="w-16 h-16 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center mx-auto mb-4">
              <Edit3 size={32} className="text-white" />
            </div>
            <h1 className="text-3xl font-bold mb-2">Content Manager</h1>
            <p className="text-gray-300">Enter password to edit website content</p>
          </div>

          <form onSubmit={handleLogin} className="space-y-6">
            <div>
              <label className="block text-sm font-semibold mb-3">Password</label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter admin password"
                  className="w-full bg-slate-800 border border-gray-600 rounded-xl px-4 py-3 text-white placeholder-gray-400 focus:border-blue-400 focus:outline-none transition-colors pr-12"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-white"
                >
                  {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              className="w-full bg-gradient-to-r from-blue-500 to-purple-600 text-white py-3 rounded-xl font-semibold hover:from-blue-600 hover:to-purple-700 transition-all duration-300"
            >
              Access Content Manager
            </button>
          </form>

          <div className="mt-6 text-center">
            <Link to="/" className="text-blue-400 hover:text-blue-300 inline-flex items-center gap-2">
              <Home size={18} />
              Back to Home
            </Link>
          </div>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen gradient-bg">
      {/* Navigation */}
      <nav className="glass-effect">
        <div className="container-max">
          <div className="flex items-center justify-between py-4 px-6">
            <div className="flex items-center gap-4">
              <Link to="/" className="text-2xl font-bold text-gradient">
                Exit Ready
              </Link>
              <span className="text-gray-400">Content Manager</span>
            </div>
            <div className="flex items-center gap-4">
              <Link 
                to="/admin/dashboard"
                className="text-gray-300 hover:text-white transition-colors duration-300 inline-flex items-center gap-2"
              >
                <SettingsIcon size={18} />
                Valuation Settings
              </Link>
              <Link 
                to="/"
                className="text-gray-300 hover:text-white transition-colors duration-300 inline-flex items-center gap-2"
              >
                <Home size={18} />
                Back to Home
              </Link>
            </div>
          </div>
        </div>
      </nav>

      <div className="section-padding">
        <div className="container-max">
          {/* Header */}
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8 }}
            className="text-center mb-12"
          >
            <h1 className="text-4xl lg:text-5xl font-bold mb-6">
              Content <span className="text-gradient">Manager</span>
            </h1>
            <p className="text-xl text-gray-300">
              Edit website copy and content without touching code
            </p>
          </motion.div>

          {/* Tabs */}
          <div className="glass-effect rounded-3xl p-8">
            <div className="flex flex-wrap gap-4 mb-8">
              {[
                { id: 'landing', label: 'Landing Page', icon: Monitor },
                { id: 'calculator', label: 'Calculator Pages', icon: FileText },
                { id: 'branding', label: 'Branding & Meta', icon: Edit3 }
              ].map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`px-6 py-3 rounded-xl font-semibold transition-all duration-300 inline-flex items-center gap-2 ${
                    activeTab === tab.id
                      ? 'bg-blue-500 text-white'
                      : 'bg-slate-800 text-gray-300 hover:bg-slate-700'
                  }`}
                >
                  <tab.icon size={18} />
                  {tab.label}
                </button>
              ))}
            </div>

            {/* Landing Page Content */}
            {activeTab === 'landing' && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3 }}
                className="space-y-8"
              >
                <h2 className="text-2xl font-bold mb-6">Landing Page Content</h2>
                
                {/* Hero Section */}
                <div className="bg-slate-800/30 rounded-lg p-6">
                  <h3 className="text-xl font-semibold mb-4 text-blue-400">Hero Section</h3>
                  <TextEditor
                    label="Main Headline"
                    value={content.landingPage?.hero?.headline}
                    path="landingPage.hero.headline"
                  />
                  <TextEditor
                    label="Subheadline"
                    value={content.landingPage?.hero?.subheadline}
                    path="landingPage.hero.subheadline"
                    multiline={true}
                  />
                  <div className="grid md:grid-cols-2 gap-4">
                    <TextEditor
                      label="Primary CTA Button"
                      value={content.landingPage?.hero?.primaryCTA}
                      path="landingPage.hero.primaryCTA"
                    />
                    <TextEditor
                      label="Secondary CTA Button"
                      value={content.landingPage?.hero?.secondaryCTA}
                      path="landingPage.hero.secondaryCTA"
                    />
                  </div>
                </div>

                {/* Value Props Section */}
                <div className="bg-slate-800/30 rounded-lg p-6">
                  <h3 className="text-xl font-semibold mb-4 text-blue-400">Value Propositions</h3>
                  <TextEditor
                    label="Section Title"
                    value={content.landingPage?.valueProps?.sectionTitle}
                    path="landingPage.valueProps.sectionTitle"
                  />
                  <TextEditor
                    label="Subtitle"
                    value={content.landingPage?.valueProps?.subtitle}
                    path="landingPage.valueProps.subtitle"
                    multiline={true}
                  />
                  <ArrayEditor
                    label="Features"
                    items={content.landingPage?.valueProps?.features}
                    path="landingPage.valueProps.features"
                  />
                </div>

                {/* Final CTA Section */}
                <div className="bg-slate-800/30 rounded-lg p-6">
                  <h3 className="text-xl font-semibold mb-4 text-blue-400">Final Call-to-Action</h3>
                  <TextEditor
                    label="Headline"
                    value={content.landingPage?.finalCTA?.headline}
                    path="landingPage.finalCTA.headline"
                  />
                  <TextEditor
                    label="Description"
                    value={content.landingPage?.finalCTA?.description}
                    path="landingPage.finalCTA.description"
                    multiline={true}
                  />
                  <TextEditor
                    label="Button Text"
                    value={content.landingPage?.finalCTA?.buttonText}
                    path="landingPage.finalCTA.buttonText"
                  />
                </div>
              </motion.div>
            )}

            {/* Calculator Content */}
            {activeTab === 'calculator' && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3 }}
                className="space-y-8"
              >
                <h2 className="text-2xl font-bold mb-6">Calculator Pages Content</h2>
                
                <div className="bg-slate-800/30 rounded-lg p-6">
                  <h3 className="text-xl font-semibold mb-4 text-blue-400">Calculator Choice Page</h3>
                  <TextEditor
                    label="Main Headline"
                    value={content.calculatorChoice?.hero?.headline}
                    path="calculatorChoice.hero.headline"
                  />
                  <TextEditor
                    label="Subtitle"
                    value={content.calculatorChoice?.hero?.subtitle}
                    path="calculatorChoice.hero.subtitle"
                    multiline={true}
                  />
                </div>

                <div className="grid md:grid-cols-2 gap-6">
                  <div className="bg-slate-800/30 rounded-lg p-6">
                    <h4 className="font-semibold mb-4 text-green-400">Simple Calculator</h4>
                    <TextEditor
                      label="Title"
                      value={content.calculatorChoice?.simpleCalculator?.title}
                      path="calculatorChoice.simpleCalculator.title"
                    />
                    <TextEditor
                      label="Description"
                      value={content.calculatorChoice?.simpleCalculator?.description}
                      path="calculatorChoice.simpleCalculator.description"
                      multiline={true}
                    />
                  </div>

                  <div className="bg-slate-800/30 rounded-lg p-6">
                    <h4 className="font-semibold mb-4 text-purple-400">Detailed Calculator</h4>
                    <TextEditor
                      label="Title"
                      value={content.calculatorChoice?.detailedCalculator?.title}
                      path="calculatorChoice.detailedCalculator.title"
                    />
                    <TextEditor
                      label="Description"
                      value={content.calculatorChoice?.detailedCalculator?.description}
                      path="calculatorChoice.detailedCalculator.description"
                      multiline={true}
                    />
                  </div>
                </div>
              </motion.div>
            )}

            {/* Branding Content */}
            {activeTab === 'branding' && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3 }}
                className="space-y-8"
              >
                <h2 className="text-2xl font-bold mb-6">Branding & SEO</h2>
                
                <div className="bg-slate-800/30 rounded-lg p-6">
                  <h3 className="text-xl font-semibold mb-4 text-blue-400">Company Information</h3>
                  <div className="grid md:grid-cols-2 gap-4">
                    <TextEditor
                      label="Company Name"
                      value={content.branding?.companyName}
                      path="branding.companyName"
                    />
                    <TextEditor
                      label="Contact Email"
                      value={content.contact?.email}
                      path="contact.email"
                    />
                  </div>
                  <TextEditor
                    label="Tagline"
                    value={content.branding?.tagline}
                    path="branding.tagline"
                  />
                </div>

                <div className="bg-slate-800/30 rounded-lg p-6">
                  <h3 className="text-xl font-semibold mb-4 text-blue-400">SEO & Meta Information</h3>
                  <TextEditor
                    label="Page Title"
                    value={content.branding?.meta?.title}
                    path="branding.meta.title"
                  />
                  <TextEditor
                    label="Meta Description"
                    value={content.branding?.meta?.description}
                    path="branding.meta.description"
                    multiline={true}
                  />
                </div>
              </motion.div>
            )}

            {/* Save Button */}
            <div className="mt-8 pt-6 border-t border-gray-700">
              <button
                onClick={saveContent}
                className="bg-gradient-to-r from-green-500 to-emerald-600 text-white px-8 py-3 rounded-xl font-semibold hover:from-green-600 hover:to-emerald-700 transition-all duration-300 inline-flex items-center gap-3"
              >
                <Save size={20} />
                Save Content Changes
              </button>
              <p className="text-gray-400 text-sm mt-2">
                This will download a JSON file. In production, changes would save automatically.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ContentManager;