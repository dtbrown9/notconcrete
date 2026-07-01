import { useEffect, useMemo, useState } from 'react'
import './styles.css'
import './styles-enhanced.css'
import { AdminDashboard } from './pages/AdminDashboard'
import { generateSubtleGradient } from './utils/gradientGenerator'

function HamburgerMenu() {
  const [isOpen, setIsOpen] = useState(false)

  const navigateTo = (path: string) => {
    window.history.pushState({}, '', path)
    window.location.reload()
  }

  return (
    <>
      <button
        className="hamburger"
        onClick={() => setIsOpen(!isOpen)}
        aria-label="Toggle menu"
      >
        <span></span>
        <span></span>
        <span></span>
      </button>
      {isOpen && (
        <div className="mobile-menu">
          <a href="#services" onClick={() => setIsOpen(false)}>
            Services
          </a>
          <a href="#process" onClick={() => setIsOpen(false)}>
            Process
          </a>
          <a href="#results" onClick={() => setIsOpen(false)}>
            Results
          </a>
          <a href="#quote-form" onClick={() => setIsOpen(false)}>
            Quote
          </a>
          <a href="#contact" onClick={() => setIsOpen(false)}>
            Contact
          </a>
          <a href="#admin" onClick={() => {
            navigateTo('/admin')
          }} style={{ fontSize: '12px', opacity: '0.7' }}>
            Admin
          </a>
        </div>
      )}
    </>
  )
}

type Service = {
  id: number
  title: string
  description: string
  category: string
  featured: number
}

type Testimonial = {
  id: number
  name: string
  role: string
  quote: string
  rating: number
}

type GalleryItem = {
  id: number
  title: string
  before_label: string
  after_label: string
  description: string
  image?: string
}

type ServiceArea = {
  id: number
  name: string
}

type SitePayload = {
  services: Service[]
  testimonials: Testimonial[]
  gallery: GalleryItem[]
  serviceAreas: ServiceArea[]
}

type QuoteForm = {
  fullName: string
  phone: string
  email: string
  serviceType: string
  propertyType: string
  address: string
  preferredDate: string
  details: string
}

type FeedbackForm = {
  name: string
  email: string
  rating: string
  message: string
}

const initialForm: QuoteForm = {
  fullName: '',
  phone: '',
  email: '',
  serviceType: '',
  propertyType: '',
  address: '',
  preferredDate: '',
  details: '',
}

const initialFeedbackForm: FeedbackForm = {
  name: '',
  email: '',
  rating: '5',
  message: '',
}

const apiBase = '/api'

const propertyTypeOptions = ['Home', 'Apartment', 'Office', 'Commercial Building', 'Construction Site', 'Rental Property', 'Other']

const defaultServices = [
  'Final Cleaning',
  'Mid-Project Cleaning',
  'Pre-Construction Prep',
  'Move-Out / Before Move-In Cleaning',
  'Commercial & Residential Power Washing',
  'Eviction Cleanups',
  'Demo Cleanup',
  'Bulk Trash Removal'
]

// Service icons mapping
const serviceIcons: Record<string, string> = {
  'Final Cleaning': '✨',
  'Mid-Project Cleaning': '🧹',
  'Pre-Construction Prep': '🏗️',
  'Move-Out / Before Move-In Cleaning': '🔑',
  'Commercial & Residential Power Washing': '💨',
  'Eviction Cleanups': '🏠',
  'Demo Cleanup': '🚛',
  'Bulk Trash Removal': '♻️',
  'Construction cleanup': '🏗️',
  'Property turnovers': '🏠',
  'Exterior refresh': '💨',
  'Special cases': '⚡',
}

const sliderAccentColors = ['#7dd3fc', '#34d399', '#fbbf24', '#f472b6']
const galleryImagePaths = [
  '/gallery/furniture-removal-before.jpg',
  '/gallery/dumpster-area-before.jpg',
  '/gallery/mattress-removal-before.jpg',
  '/gallery/ottoman-removal-before.jpg',
]
function GalleryCard({ item, accentIndex }: { item: GalleryItem; accentIndex: number }) {
  const accent = sliderAccentColors[accentIndex % sliderAccentColors.length]
  const imageSrc = item.image ?? galleryImagePaths[accentIndex % galleryImagePaths.length]

  return (
    <article className="gallery-card glass">
      <div className="before-after-copy">
        <p className="card-label">Project photo</p>
        <h3>{item.title}</h3>
        <p>{item.description}</p>
      </div>
      <div className="gallery-photo-frame">
        <img className="gallery-photo" src={imageSrc} alt={item.title} />
      </div>
      <div className="gallery-caption">
        <strong>{item.before_label} photo</strong>
        <span>{item.after_label} result shown in the same image set</span>
      </div>
    </article>
  )
}

export default function App() {
  const defaultData: SitePayload = {
    services: [
      { id: 1, title: "Construction Cleanup", description: "Post-construction cleanup and debris removal", category: "Construction", featured: 1, sort_order: 1 },
      { id: 2, title: "Move-Out Cleaning", description: "Thorough cleaning for move-outs and turnovers", category: "Residential", featured: 1, sort_order: 2 },
      { id: 3, title: "Eviction Cleanups", description: "Professional eviction cleanup services", category: "Residential", featured: 1, sort_order: 3 },
      { id: 4, title: "Bulk Trash Removal", description: "Large-scale debris and trash hauling", category: "General", featured: 0, sort_order: 4 },
      { id: 5, title: "Power Washing", description: "Commercial and residential power washing", category: "General", featured: 0, sort_order: 5 },
      { id: 6, title: "Commercial Cleaning", description: "Office and commercial space cleaning", category: "Commercial", featured: 0, sort_order: 6 },
      { id: 7, title: "Pressure Washing", description: "Driveways, decks, and exterior pressure washing", category: "General", featured: 0, sort_order: 7 },
      { id: 8, title: "Specialized Cleanup", description: "Custom cleanup solutions for unique projects", category: "General", featured: 0, sort_order: 8 },
    ],
    testimonials: [
      { id: 1, name: "Sarah Martinez", role: "Property Manager", quote: "Professional crew, thorough work, and they actually cared about getting it right.", rating: 5, sort_order: 1 },
      { id: 2, name: "John Chen", role: "Contractor", quote: "Fast turnaround on post-construction cleanup. Highly recommend for any contractor.", rating: 5, sort_order: 2 },
      { id: 3, name: "Lisa Thompson", role: "Landlord", quote: "Reliable, punctual, and they handle the whole process from quote to completion.", rating: 5, sort_order: 3 },
    ],
    gallery: [
      {
        id: 1,
        title: "Furniture Removal Cleanup",
        before_label: "Before",
        after_label: "After",
        description: "Couch and bulk debris removed from the property.",
        image: '/gallery/furniture-removal-before.jpg',
        sort_order: 1,
      },
      {
        id: 2,
        title: "Dumpster Area Cleanup",
        before_label: "Before",
        after_label: "After",
        description: "Overflowing dumpster area cleared and cleaned up.",
        image: '/gallery/dumpster-area-before.jpg',
        sort_order: 2,
      },
    ],
    serviceAreas: [
      { id: 1, name: "Local metro area", sort_order: 1 },
      { id: 2, name: "Nearby suburbs", sort_order: 2 },
      { id: 3, name: "Commercial districts", sort_order: 3 },
      { id: 4, name: "Industrial and construction sites", sort_order: 4 },
    ],
  }

  const [data, setData] = useState<SitePayload>(defaultData)
  const [loading, setLoading] = useState(false)
  const [quoteForm, setQuoteForm] = useState(initialForm)
  const [feedbackForm, setFeedbackForm] = useState(initialFeedbackForm)
  const [status, setStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle')
  const [feedbackStatus, setFeedbackStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle')
  const [currentPage, setCurrentPage] = useState<'home' | 'admin'>('home')
  const [heroGradient, setHeroGradient] = useState('')
  const [servicesHeadingGradient, setServicesHeadingGradient] = useState('')
  const [processHeadingGradient, setProcessHeadingGradient] = useState('')
  const [testimonialHeadingGradient, setTestimonialHeadingGradient] = useState('')
  const [serviceAreaHeadingGradient, setServiceAreaHeadingGradient] = useState('')

  // Handle routing based on pathname
  useEffect(() => {
    const pathname = window.location.pathname
    if (pathname === '/admin') {
      setCurrentPage('admin')
    } else {
      setCurrentPage('home')
    }

    const handlePopstate = () => {
      const newPathname = window.location.pathname
      setCurrentPage(newPathname === '/admin' ? 'admin' : 'home')
    }

    window.addEventListener('popstate', handlePopstate)
    return () => window.removeEventListener('popstate', handlePopstate)
  }, [])

  // Initialize random gradients on mount
  useEffect(() => {
    setHeroGradient(generateSubtleGradient())
    setServicesHeadingGradient(generateSubtleGradient())
    setProcessHeadingGradient(generateSubtleGradient())
    setTestimonialHeadingGradient(generateSubtleGradient())
    setServiceAreaHeadingGradient(generateSubtleGradient())
  }, [])

  useEffect(() => {
    const load = async () => {
      try {
        // Try direct backend URL first (works better than proxy in dev)
        console.log('Fetching fresh data from API...')
        const controller = new AbortController()
        const timeout = setTimeout(() => controller.abort(), 5000)
        
        try {
          const directRes = await fetch('http://localhost:3001/api/site', { 
            mode: 'cors',
            signal: controller.signal
          })
          clearTimeout(timeout)
          
          if (directRes.ok) {
            const siteJson = (await directRes.json()) as SitePayload
            console.log('✅ Fresh data loaded from API')
            setData(siteJson)
            return
          }
        } catch (err) {
          clearTimeout(timeout)
          console.log('Direct backend request failed (using fallback):', err)
        }
      } catch (err) {
        console.log('Unexpected error (using fallback):', err)
      }

      try {
        // Fallback to proxy
        console.log('Trying proxy endpoint...')
        const proxyRes = await fetch(`${apiBase}/site`)
        if (proxyRes.ok) {
          const siteJson = (await proxyRes.json()) as SitePayload
          console.log('✅ Fresh data loaded from proxy')
          setData(siteJson)
          return
        }
      } catch (err) {
        console.log('Proxy request failed (using fallback):', err)
      }

      console.log('Using default fallback data')
    }

    // Add a small delay to ensure server is ready
    const timer = setTimeout(load, 500)
    return () => clearTimeout(timer)
  }, [])

  const serviceGroups = useMemo(() => {
    const orderedCategories = ['Construction Cleaning', 'Residential & Commercial', 'Exterior Care', 'Specialty Services', 'Cleanup Services']
    return orderedCategories
      .map((category) => ({
        category,
        services: data.services.filter((service) => service.category === category),
      }))
      .filter((group) => group.services.length > 0)
  }, [data])

  const featuredServices = useMemo(() => data.services.filter((service) => service.featured === 1).slice(0, 4), [data])

  const serviceOptions = useMemo(() => data.services.map((service) => service.title), [data])

  const serviceSummaries = useMemo(() => {
    return [
      {
        label: 'Construction cleanup',
        title: 'Build-ready cleaning',
        items: data?.services.filter((service) => service.category === 'Construction Cleaning').slice(0, 3) ?? [],
      },
      {
        label: 'Property turnovers',
        title: 'Move-out and move-in prep',
        items: data?.services.filter((service) => service.category === 'Residential & Commercial').slice(0, 2) ?? [],
      },
      {
        label: 'Exterior refresh',
        title: 'Power washing and cleanup',
        items: data?.services.filter((service) => service.category === 'Exterior Care' || service.category === 'Cleanup Services').slice(0, 3) ?? [],
      },
      {
        label: 'Special cases',
        title: 'Eviction and demo work',
        items: data?.services.filter((service) => service.category === 'Specialty Services').slice(0, 2) ?? [],
      },
    ]
  }, [data])

  const submitQuote = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setStatus('saving')

    const response = await fetch(`${apiBase}/quotes`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(quoteForm),
    })

    if (!response.ok) {
      setStatus('error')
      return
    }

    setStatus('saved')
    setQuoteForm(initialForm)
  }

  const submitFeedback = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setFeedbackStatus('saving')

    try {
      const response = await fetch('/api/feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(feedbackForm),
      })

      if (!response.ok) {
        setFeedbackStatus('error')
        return
      }

      setFeedbackStatus('saved')
      setFeedbackForm(initialFeedbackForm)
    } catch {
      setFeedbackStatus('error')
    }
  }

  // Render admin dashboard if on /admin route
  if (currentPage === 'admin') {
    return <AdminDashboard />
  }

  return (
    <div className="page-shell">
      <header className="hero" style={{ background: heroGradient }}>
        <nav className="topbar">
          <div>
            <p className="eyebrow">Not Concrete Cleaning Co.</p>
            <h1 style={{ textAlign: 'center' }}>A cleaner, simpler way to handle construction cleanup, turnovers, and power washing.</h1>
          </div>
          <HamburgerMenu />
        </nav>

        <div className="hero-grid">
          <div className="hero-copy">
            <p className="lead">
              Licensed, insured, state-registered, and minority owned. We handle construction cleanup, move-out
              cleaning, bulk trash removal, eviction cleanups, and commercial or residential power washing with a
              layout that keeps the main services easy to scan.
            </p>
            <div className="quick-facts">
              <div>
                <strong>Licensed</strong>
                <span>Professional service you can trust.</span>
              </div>
              <div>
                <strong>Insured</strong>
                <span>Coverage for property and crew safety.</span>
              </div>
              <div>
                <strong>Minority owned</strong>
                <span>Locally owned with community focus.</span>
              </div>
            </div>
            <div className="cta-row">
              <a className="primary-button" href="#quote-form">
                Get a Free Quote
              </a>
              <a className="secondary-button" href="#services">
                Explore Services
              </a>
            </div>
          </div>
          <div className="hero-aside">
            <article className="hero-card glass">
              <p className="card-label">Most requested services</p>
              <div className="service-stack compact">
                {featuredServices.map((service) => (
                  <div key={service.id} className="mini-service">
                    <strong>{service.title}</strong>
                    <span>{service.category}</span>
                  </div>
                ))}
              </div>
            </article>
            <article className="hero-card glass hero-side-note">
              <p className="card-label">Quick note</p>
              <p>
                We keep the customer path simple: review the service groups, check the results, then request a quote.
              </p>
            </article>
          </div>
        </div>
      </header>

      <main>
        <section id="services" className="section-block">
          <div className="section-heading" style={{ background: servicesHeadingGradient }}>
            <p className="eyebrow">Services</p>
            <h2>Services grouped by project type, so it’s easy to find what fits.</h2>
            <p className="section-subcopy">
              Start with the category that matches your job, then pick the exact service you need.
            </p>
          </div>
          {loading ? (
            <p>Loading services...</p>
          ) : (
            <div className="service-section-list">
              {serviceSummaries.map((group) => (
                <section key={group.label} className="service-group glass">
                  <div className="service-group-header">
                    <p className="service-category">{group.label}</p>
                    <h3>{group.title}</h3>
                  </div>
                  <div className="service-grid service-grid-tight">
                    {group.items.map((service) => (
                      <article key={service.id} className="service-card service-card-organized">
                        <h4>
                          <span className="service-icon">{serviceIcons[service.title] || '🔧'}</span>
                          {service.title}
                        </h4>
                        <p>{service.description}</p>
                      </article>
                    ))}
                  </div>
                </section>
              ))}
            </div>
          )}
        </section>

        <section id="process" className="section-block split-layout">
          <div style={{ background: processHeadingGradient, padding: '20px', borderRadius: '12px' }}>
            <p className="eyebrow">Process</p>
            <h2>Simple steps, clear communication, no guessing.</h2>
            <div className="process-grid">
              <article className="process-step glass">
                <h3>Request</h3>
                <p>Tell us the property, the service, and the timing.</p>
              </article>
              <article className="process-step glass">
                <h3>Review</h3>
                <p>We confirm the scope, access, and estimated cost.</p>
              </article>
              <article className="process-step glass">
                <h3>Work</h3>
                <p>Our crew arrives ready to clean, remove, or wash.</p>
              </article>
              <article className="process-step glass">
                <h3>Finish</h3>
                <p>We complete the walkthrough and make sure it looks right.</p>
              </article>
            </div>
          </div>
          <div className="glass process-panel">
            <p className="card-label">What to expect</p>
            <p>We emphasize reliable crews, clear communication, and a professional finish on every job.</p>
            <p>Every estimate is reviewed with the scope, timing, and access details up front so there are no surprises.</p>
          </div>
        </section>

        <section id="results" className="section-block">
          <div className="section-heading" style={{ background: testimonialHeadingGradient }}>
            <p className="eyebrow">Results</p>
            <h2>Photos from recent cleanup jobs.</h2>
            <p className="section-subcopy">A closer look at the work we completed on site without hiding the details.</p>
          </div>
          <div className="gallery-grid results-grid">
            {data.gallery.map((item, index) => (
              <GalleryCard key={item.id} item={item} accentIndex={index} />
            ))}
          </div>
        </section>

        <section id="testimonials" className="section-block">
          <div className="section-heading" style={{ background: testimonialHeadingGradient }}>
            <p className="eyebrow">Testimonials</p>
            <h2>Clients remember the professionalism and the finish.</h2>
          </div>
          <div className="testimonial-stack">
            {data?.testimonials.map((testimonial) => (
              <blockquote key={testimonial.id} className="glass testimonial-card">
                <p>“{testimonial.quote}”</p>
                <footer>
                  <strong>{testimonial.name}</strong>
                  <span>{testimonial.role}</span>
                </footer>
              </blockquote>
            ))}
          </div>
        </section>

        <section id="contact" className="section-block split-layout">
          <div style={{ background: serviceAreaHeadingGradient, padding: '20px', borderRadius: '12px' }}>
            <p className="eyebrow">Service Area</p>
            <h2>Serving local homes, apartments, offices, and job sites.</h2>
            <div className="service-area-list">
              {data?.serviceAreas.map((area) => (
                <span key={area.id} className="badge">
                  {area.name}
                </span>
              ))}
            </div>
          </div>
          <div className="glass contact-card">
            <p className="card-label">Call for a quote</p>
            <p>We respond quickly and can handle residential, commercial, and construction cleanup requests.</p>
            <p>Phone: (555) 123-4567</p>
            <p>Email: quotes@notconcretecleaning.com</p>
          </div>
        </section>

        <section id="quote-form" className="section-block quote-section">
          <div className="section-heading">
            <p className="eyebrow">Free Quote</p>
            <h2>Tell us what needs to be cleaned.</h2>
            <p className="section-subcopy">Use the form below so we can give you a cleaner, faster estimate.</p>
          </div>
          <div className="quote-layout">
            <form className="quote-form glass" onSubmit={submitQuote}>
              <div className="form-grid">
                <label>
                  Full name
                  <input value={quoteForm.fullName} onChange={(e) => setQuoteForm({ ...quoteForm, fullName: e.target.value })} />
                </label>
                <label>
                  Phone
                  <input value={quoteForm.phone} onChange={(e) => setQuoteForm({ ...quoteForm, phone: e.target.value })} />
                </label>
                <label>
                  Email
                  <input value={quoteForm.email} onChange={(e) => setQuoteForm({ ...quoteForm, email: e.target.value })} />
                </label>
                <label>
                  Service needed
                  <select value={quoteForm.serviceType} onChange={(e) => setQuoteForm({ ...quoteForm, serviceType: e.target.value })}>
                    <option value="">Choose a service</option>
                    {serviceOptions.map((service) => (
                      <option key={service} value={service}>
                        {service}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  Property type
                  <select value={quoteForm.propertyType} onChange={(e) => setQuoteForm({ ...quoteForm, propertyType: e.target.value })}>
                    <option value="">Choose a property type</option>
                    {propertyTypeOptions.map((option) => (
                      <option key={option} value={option}>
                        {option}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  Address
                  <input value={quoteForm.address} onChange={(e) => setQuoteForm({ ...quoteForm, address: e.target.value })} />
                </label>
                <label>
                  Preferred date
                  <input value={quoteForm.preferredDate} onChange={(e) => setQuoteForm({ ...quoteForm, preferredDate: e.target.value })} />
                </label>
                <label className="full-width">
                  Project details
                  <textarea value={quoteForm.details} onChange={(e) => setQuoteForm({ ...quoteForm, details: e.target.value })} rows={5} />
                </label>
              </div>
              <button className="primary-button" type="submit" disabled={status === 'saving'}>
                {status === 'saving' ? 'Sending...' : 'Send Quote Request'}
              </button>
              {status === 'saved' && <p className="success-text">Thanks. Your request has been saved in the database.</p>}
              {status === 'error' && <p className="error-text">Please fill out the form and try again.</p>}
            </form>
          </div>
        </section>

        <section id="feedback" className="section-block feedback-section">
          <div className="section-heading">
            <p className="eyebrow">Feedback</p>
            <h2>Tell us how the job went.</h2>
            <p className="section-subcopy">
              Leave a quick note after service so we can keep improving and highlight the jobs customers remember.
            </p>
          </div>
          <div className="feedback-layout">
            <div className="glass feedback-summary">
              <p className="card-label">Why we ask</p>
              <p>Your feedback helps us improve crew communication, finish quality, and turnaround time.</p>
              <div className="feedback-points">
                <div>
                  <strong>Clear communication</strong>
                  <span>Tell us what was smooth and what needs work.</span>
                </div>
                <div>
                  <strong>Finish quality</strong>
                  <span>Let us know if the final walkthrough met expectations.</span>
                </div>
                <div>
                  <strong>Response time</strong>
                  <span>Share whether the quote and follow-up were fast enough.</span>
                </div>
              </div>
            </div>
            <form className="glass feedback-form" onSubmit={submitFeedback}>
              <div className="form-grid feedback-grid">
                <label>
                  Your name
                  <input value={feedbackForm.name} onChange={(e) => setFeedbackForm({ ...feedbackForm, name: e.target.value })} />
                </label>
                <label>
                  Email
                  <input value={feedbackForm.email} onChange={(e) => setFeedbackForm({ ...feedbackForm, email: e.target.value })} />
                </label>
                <label>
                  Rating
                  <select value={feedbackForm.rating} onChange={(e) => setFeedbackForm({ ...feedbackForm, rating: e.target.value })}>
                    {[5, 4, 3, 2, 1].map((rating) => (
                      <option key={rating} value={rating}>
                        {rating} star{rating > 1 ? 's' : ''}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="full-width">
                  Message
                  <textarea value={feedbackForm.message} onChange={(e) => setFeedbackForm({ ...feedbackForm, message: e.target.value })} rows={5} />
                </label>
              </div>
              <button className="primary-button" type="submit" disabled={feedbackStatus === 'saving'}>
                {feedbackStatus === 'saving' ? 'Sending...' : 'Send Feedback'}
              </button>
              {feedbackStatus === 'saved' && <p className="success-text">Thanks. Your feedback has been sent for review.</p>}
              {feedbackStatus === 'error' && <p className="error-text">Please add a message and try again.</p>}
            </form>
          </div>
        </section>
      </main>
    </div>
  )
}