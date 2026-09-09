"use client"; 
 
import Image from "next/image"; 
import Link from "next/link"; 
import { useEffect, useState } from "react"; 
import type { ReactNode } from "react"; 
 
import { 
  Truck, 
  ShieldCheck, 
  RotateCcw, 
  Headphones, 
} from "lucide-react"; 
 
// Swiper 
import { Swiper, SwiperSlide } from "swiper/react"; 
import type { Swiper as SwiperType } from "swiper"; 
import { Autoplay, Navigation, Mousewheel } from "swiper/modules";
import "swiper/css"; 
import "swiper/css/navigation"; 
 
import { 
  ChevronLeft, 
  ChevronRight, 
} from "lucide-react"; 
 
import ProductsByCategory from "@/components/products/ProductsByCategory"; 
import { PageLoader } from "@/components/ui/Spinner"; 
import { catalogApi } from "@/lib/api"; 
import type { Category } from "@/types"; 
 
type CategoryWithImage = Category & { 
  image_url?: string | null; 
  subcategories?: Category[]; 
  children?: Category[]; 
}; 
 
type Subcategory = CategoryWithImage & { 
  parent_id: number; 
}; 
 
type PromoImageProps = { 
  src: string; 
  alt: string; 
  fallback: string; 
  className?: string; 
  priority?: boolean; 
}; 
 
function PromoImage({ 
  src, 
  alt, 
  fallback, 
  className = "", 
  priority = false, 
}: PromoImageProps) { 
  const [imageFailed, setImageFailed] = useState(false); 
 
  if (imageFailed) { 
    return ( 
      <div className="absolute inset-0 flex items-center justify-center"> 
        <span className="select-none text-7xl drop-shadow-xl sm:text-8xl"> 
          {fallback} 
        </span> 
      </div> 
    ); 
  } 
 
  return ( 
    <Image 
      src={src} 
      alt={alt} 
      fill 
      priority={priority} 
      sizes="(max-width: 1024px) 100vw, 50vw" 
      className={`object-contain ${className}`} 
      onError={() => setImageFailed(true)} 
    /> 
  ); 
} 
 
// --------------------------------------------------------------------------- 
// Hero slider data — 3 slides. 
// --------------------------------------------------------------------------- 
const heroSlides = [ 
  { 
    tag: "Featured Technology", 
    title: ( 
      <> 
        Upgrade Your World With{" "} 
        <span className="text-[#F59E0B]"> 
          Smarter Gadgets 
        </span> 
      </> 
    ), 
    description: 
      "Discover premium laptops, smartphones, tablets and accessories selected to make everyday life easier.", 
    price: "236", 
    discount: "Save up to 25%", 
    image: "/mobile.png", 
    fallback: "💻", 
    ctaHref: "#shop-by-category", 
  }, 
  { 
    tag: "Hot Deal", 
    title: ( 
      <> 
        Power Through Your Day With{" "} 
        <span className="text-[#F59E0B]"> 
          Pro Laptops 
        </span> 
      </> 
    ), 
    description: 
      "High-performance laptops built for work, gaming, and everything in between.", 
    price: "412", 
    discount: "Save up to 20%", 
    image: "/laptp2.png", 
    fallback: "💻", 
    ctaHref: "#shop-by-category", 
  }, 
  { 
    tag: "Just Dropped", 
    title: ( 
      <> 
        Capture Every Moment With{" "} 
        <span className="text-[#F59E0B]"> 
          Smart Cameras 
        </span> 
      </> 
    ), 
    description: 
      "Power, performance, and productivity in one setup", 
    price: "189", 
    discount: "Save up to 30%", 
    image: "/sle1.png", 
    fallback: "📷", 
    ctaHref: "#shop-by-category", 
  }, 
]; 
 
export default function HomePage() { 
  /* 
   * The API returns main categories with their subcategories 
   * nested inside them. 
   * 
   * The customer-facing "Shop by Category" section should 
   * display the subcategories, not the main categories. 
   */ 
  const [subcategories, setSubcategories] = 
    useState<Subcategory[]>([]); 
 
  const [loading, setLoading] = useState(true); 
  const [error, setError] = useState(""); 
  const [activeHeroSlide, setActiveHeroSlide] = useState(0); 
 
  const [categorySwiper, setCategorySwiper] = 
    useState<SwiperType | null>(null); 
 
  const [isCategoryStart, setIsCategoryStart] = 
    useState(true); 
 
  const [isCategoryEnd, setIsCategoryEnd] = 
    useState(false); 
 
  useEffect(() => { 
    let pageIsActive = true; 
 
    async function loadCategories() { 
      try { 
        setLoading(true); 
        setError(""); 
 
        const categoryData = 
          await catalogApi.getCategories(); 
 
        if (!pageIsActive) { 
          return; 
        } 
 
        /* 
         * The backend returns main categories. 
         * 
         * Each main category contains either: 
         * - subcategories[] 
         * - children[] 
         * 
         * Extract those nested categories and use them 
         * as the customer-facing Shop by Category cards. 
         */ 
        const extractedSubcategories: Subcategory[] = []; 
 
        categoryData.forEach((mainCategory) => { 
          const category = 
            mainCategory as CategoryWithImage; 
 
          const nestedCategories = 
            Array.isArray(category.subcategories) 
              ? category.subcategories 
              : Array.isArray(category.children) 
                ? category.children 
                : []; 
 
          nestedCategories.forEach( 
            (subcategory) => { 
              if ( 
                subcategory && 
                subcategory.id !== undefined && 
                subcategory.parent_id !== null && 
                subcategory.parent_id !== undefined 
              ) { 
                extractedSubcategories.push({ 
                  ...(subcategory as Subcategory), 
                  parent_id: 
                    Number(subcategory.parent_id) || 
                    Number(category.id), 
                }); 
              } 
            }, 
          ); 
        }); 
 
        setSubcategories( 
          extractedSubcategories, 
        ); 
      } catch (error) { 
        console.error( 
          "Unable to load categories:", 
          error, 
        ); 
 
        if (pageIsActive) { 
          setError( 
            "Unable to load categories. Make sure the Laravel API is running.", 
          ); 
        } 
      } finally { 
        if (pageIsActive) { 
          setLoading(false); 
        } 
      } 
    } 
 
    loadCategories(); 
 
    return () => { 
      pageIsActive = false; 
    }; 
  }, []); 
 
  if (loading) { 
    return <PageLoader />; 
  } 
 
  /* 
   * Calculate the number of visible category cards 
   * based on the actual number of subcategories. 
   * 
   * This prevents empty space when there are fewer 
   * than 6 subcategories on desktop. 
   */ 
  const desktopCategorySlides = Math.min( 
    subcategories.length, 
    6, 
  ); 
 
  const tabletCategorySlides = Math.min( 
    subcategories.length, 
    4.2, 
  ); 
 
  const mobileCategorySlides = Math.min( 
    subcategories.length, 
    3.2, 
  ); 
 
  const smallMobileCategorySlides = Math.min( 
    subcategories.length, 
    2.2, 
  ); 
 
  return ( 
    <main className="min-h-screen bg-slate-50"> 
      {/* Promotional information bar */} 
      <section className="border-b border-slate-200 bg-white"> 
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-center gap-x-8 gap-y-2 px-4 py-2.5 text-xs font-medium text-slate-600 sm:px-6 lg:px-8"> 
          <span className="flex items-center gap-2"> 
            <span className="text-base"> 
              🚚 
            </span> 
 
            Free delivery on selected orders 
          </span> 
 
          <span className="hidden h-4 w-px bg-slate-300 sm:block" /> 
 
          <span className="flex items-center gap-2"> 
            <span className="text-base"> 
              🔥 
            </span> 
 
            New deals added every week 
          </span> 
 
          <span className="hidden h-4 w-px bg-slate-300 sm:block" /> 
 
          <span className="flex items-center gap-2"> 
            <span className="text-base"> 
              🛡️ 
            </span> 
 
            Secure and trusted shopping 
          </span> 
        </div> 
      </section> 
 
      {/* Hero promotional section */} 
      <section className="px-4 pb-5 pt-6 sm:px-6 lg:px-8"> 
        <div className="mx-auto grid max-w-7xl grid-cols-1 gap-4 lg:grid-cols-12"> 
          {/* Main large promotional banner */} 
          <article className="relative min-h-[450px] overflow-hidden rounded-3xl bg-gradient-to-br from-[#121358] via-[#242675] to-[#4b4eb5] text-white shadow-xl sm:min-h-[410px] lg:col-span-8"> 
            {/* Decorative background */} 
            <div className="pointer-events-none absolute -left-24 -top-24 z-0 h-72 w-72 rounded-full bg-white/10 blur-3xl" /> 
 
            <div className="pointer-events-none absolute -bottom-32 right-10 z-0 h-80 w-80 rounded-full bg-[#F59E0B]/30 blur-3xl" /> 
 
            <Swiper 
              modules={[Autoplay]} 
              autoplay={{ 
                delay: 5000, 
                disableOnInteraction: false, 
              }} 
              loop 
              onSlideChange={(swiper) => 
                setActiveHeroSlide( 
                  swiper.realIndex, 
                ) 
              } 
              className="hero-swiper relative z-10" 
            > 
              {heroSlides.map((slide, index) => ( 
                <SwiperSlide key={slide.tag}> 
                  <div className="relative min-h-[450px] px-6 py-9 sm:min-h-[410px] sm:px-10 sm:py-12 lg:px-12"> 
                    <div className="relative z-20 max-w-xl"> 
                      <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-4 py-2 text-xs font-bold uppercase tracking-[0.18em] backdrop-blur-sm"> 
                        <span className="h-2 w-2 animate-pulse rounded-full bg-[#F59E0B]" /> 
 
                        {slide.tag} 
                      </div> 
 
                      <h1 className="max-w-lg text-3xl font-black leading-tight sm:text-4xl lg:text-5xl"> 
                        {slide.title} 
                      </h1> 
 
                      <p className="mt-5 max-w-md text-sm leading-7 text-white/80 sm:text-base"> 
                        {slide.description} 
                      </p> 
 
                      <div className="mt-6 flex items-end gap-3"> 
                        <div> 
                          <p className="text-xs font-medium uppercase tracking-wider text-white/60"> 
                            Starting from 
                          </p> 
 
                          <p className="mt-1 text-3xl font-black text-white"> 
                            ${slide.price} 
 
                            <span className="text-base font-semibold text-white/60"> 
                              .00 
                            </span> 
                          </p> 
                        </div> 
 
                        <span className="mb-1 rounded-md bg-[#F59E0B] px-2.5 py-1 text-xs font-bold text-white"> 
                          {slide.discount} 
                        </span> 
                      </div> 
 
                      <div className="mt-8 flex flex-wrap gap-3"> 
                        <Link 
                          href={slide.ctaHref} 
                          className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#F59E0B] px-6 py-3 text-sm font-bold text-white shadow-lg transition duration-300 hover:-translate-y-0.5 hover:bg-[#dc8908] hover:shadow-xl" 
                        > 
                          Shop Now 
 
                          <svg 
                            className="h-4 w-4" 
                            fill="none" 
                            viewBox="0 0 24 24" 
                            stroke="currentColor" 
                            aria-hidden="true" 
                          > 
                            <path 
                              strokeLinecap="round" 
                              strokeLinejoin="round" 
                              strokeWidth={2} 
                              d="m9 18 6-6-6-6" 
                            /> 
                          </svg> 
                        </Link> 
 
                        <Link 
                          href="/products" 
                          className="inline-flex items-center justify-center rounded-xl border border-white/40 bg-white/10 px-6 py-3 text-sm font-bold text-white backdrop-blur-sm transition duration-300 hover:bg-white hover:text-[#121358]" 
                        > 
                          Browse All 
                        </Link> 
                      </div> 
                    </div> 
 
                    {/* Slide product image */} 
                    <div className="absolute bottom-0 right-0 z-10 h-[48%] w-[70%] sm:h-[88%] sm:w-[52%] lg:right-2"> 
                      <PromoImage 
                        src={slide.image} 
                        alt={`${slide.tag} promotion`} 
                        fallback={slide.fallback} 
                        className="object-bottom drop-shadow-2xl" 
                        priority={index === 0} 
                      /> 
                    </div> 
                  </div> 
                </SwiperSlide> 
              ))} 
            </Swiper> 
 
            {/* Custom slide indicators */} 
            <div className="absolute bottom-5 left-1/2 z-20 flex -translate-x-1/2 gap-2 sm:left-auto sm:right-8 sm:translate-x-0"> 
              {heroSlides.map((slide, index) => ( 
                <span 
                  key={slide.tag} 
                  className={`h-2 rounded-full transition-all duration-300 ${ 
                    activeHeroSlide === index 
                      ? "w-6 bg-[#F59E0B]" 
                      : "w-2 bg-white/40" 
                  }`} 
                /> 
              ))} 
            </div> 
 
            {/* Makes the Swiper wrapper/slides fill the banner's height */} 
            <style jsx global>{` 
              .hero-swiper, 
              .hero-swiper .swiper-wrapper, 
              .hero-swiper .swiper-slide { 
                height: 100%; 
              } 
            `}</style> 
          </article> 
 
          {/* Right-side promotional banners */} 
          <div className="grid gap-4 sm:grid-cols-2 lg:col-span-4 lg:grid-cols-1"> 
            {/* Smart watch banner */} 
            <article className="group relative min-h-[200px] overflow-hidden rounded-3xl bg-gradient-to-br from-[#ffd52a] to-[#f3a900] p-6 shadow-lg transition duration-300 hover:-translate-y-1 hover:shadow-xl"> 
              <div className="relative z-20 max-w-[58%]"> 
                <span className="inline-block rounded-full bg-black/10 px-3 py-1 text-[10px] font-black uppercase tracking-wider text-[#121358]"> 
                  Trending 
                </span> 
 
                <h2 className="mt-3 text-xl font-black leading-tight text-[#121358] sm:text-2xl"> 
                  Ultra Smart Watch 
                </h2> 
 
                <p className="mt-2 text-xs font-medium text-[#121358]/70"> 
                  Style, health and technology on your wrist. 
                </p> 
 
                <p className="mt-3 text-sm font-bold text-[#121358]"> 
                  Starting $19.00 
                </p> 
 
                <Link 
                  href="/categories/Accessories" 
                  className="mt-4 inline-flex items-center gap-1 text-xs font-black uppercase tracking-wide text-[#121358] underline decoration-2 underline-offset-4" 
                > 
                  Shop now 
 
                  <span aria-hidden="true"> 
                    → 
                  </span> 
                </Link> 
              </div> 
 
              <div className="absolute bottom-1 right-0 h-[88%] w-[45%] transition duration-500 group-hover:scale-105 group-hover:-rotate-3"> 
                <PromoImage 
                  src="/watch1.png" 
                  alt="Smart watch promotion" 
                  fallback="⌚" 
                  className="object-bottom" 
                /> 
              </div> 
 
              <div className="pointer-events-none absolute -right-10 -top-14 h-40 w-40 rounded-full bg-white/30 blur-2xl" /> 
            </article> 
 
            {/* Headphone banner */} 
            <article className="group relative min-h-[200px] overflow-hidden rounded-3xl bg-gradient-to-br from-[#7146d9] via-[#8b5de7] to-[#d167c7] p-6 text-white shadow-lg transition duration-300 hover:-translate-y-1 hover:shadow-xl"> 
              <div className="relative z-20 max-w-[58%]"> 
                <span className="inline-block rounded-full bg-white/15 px-3 py-1 text-[10px] font-black uppercase tracking-wider text-white"> 
                  New Arrival 
                </span> 
 
                <h2 className="mt-3 text-xl font-black leading-tight sm:text-2xl"> 
                  Wireless Headphones 
                </h2> 
 
                <p className="mt-2 text-xs font-medium text-white/80"> 
                  Rich sound with comfortable all-day listening. 
                </p> 
 
                <p className="mt-3 text-sm font-bold text-white"> 
                  Starting $36.00 
                </p> 
 
                <Link 
                  href="/categories/earbuds" 
                  className="mt-4 inline-flex items-center gap-1 text-xs font-black uppercase tracking-wide text-white underline decoration-2 underline-offset-4" 
                > 
                  Shop now 
 
                  <span aria-hidden="true"> 
                    → 
                  </span> 
                </Link> 
              </div> 
 
              <div className="absolute bottom-0 right-0 h-[90%] w-[48%] transition duration-500 group-hover:scale-105 group-hover:rotate-3"> 
                <PromoImage 
                  src="/earsbads.png" 
                  alt="Wireless headphones promotion" 
                  fallback="🎧" 
                  className="object-bottom" 
                /> 
              </div> 
 
              <div className="pointer-events-none absolute -bottom-16 -right-10 h-44 w-44 rounded-full bg-white/20 blur-2xl" /> 
            </article> 
          </div> 
        </div> 
      </section> 
 
      {/* Service benefits */} 
      <section className="px-4 py-5 sm:px-6 lg:px-8"> 
        <div className="mx-auto grid max-w-7xl grid-cols-2 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm lg:grid-cols-4"> 
          <ServiceItem 
            icon={ 
              <Truck 
                size={22} 
                strokeWidth={2.2} 
              /> 
            } 
            title="Fast Delivery" 
            description="Quick delivery service" 
          /> 
 
          <ServiceItem 
            icon={ 
              <ShieldCheck 
                size={22} 
                strokeWidth={2.2} 
              /> 
            } 
            title="Secure Payment" 
            description="Protected transactions" 
          /> 
 
          <ServiceItem 
            icon={ 
              <RotateCcw 
                size={22} 
                strokeWidth={2.2} 
              /> 
            } 
            title="Easy Returns" 
            description="Simple return process" 
          /> 
 
          <ServiceItem 
            icon={ 
              <Headphones 
                size={22} 
                strokeWidth={2.2} 
              /> 
            } 
            title="Customer Support" 
            description="We are ready to help" 
          /> 
        </div> 
      </section> 
 
      {/* Shop by category */} 
      <section 
        id="shop-by-category" 
        className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8" 
      > 
        <div className="mb-7 flex flex-wrap items-end justify-between gap-4"> 
          <div> 
            <p className="text-sm font-bold uppercase tracking-[0.2em] text-[#F59E0B]"> 
              Find what you need 
            </p> 
 
            <h2 className="mt-2 text-2xl font-black text-[#121358] sm:text-3xl"> 
              Shop by Category 
            </h2> 
 
            <p className="mt-2 text-sm text-slate-500"> 
              Explore our most popular technology categories. 
            </p> 
          </div> 
 
         
        </div> 
 
        {error && ( 
          <div className="mb-6 rounded-xl border border-red-200 bg-red-50 p-4 text-sm font-medium text-red-700"> 
            {error} 
          </div> 
        )} 
 
        {subcategories.length > 0 ? ( 
          <div className="relative"> 
          <Swiper
  modules={[Navigation, Mousewheel]}
  spaceBetween={16}
  slidesPerView={
    smallMobileCategorySlides
  }
  watchOverflow={false}
  grabCursor={true}
  allowTouchMove={true}
  mousewheel={{
    forceToAxis: true,
    sensitivity: 1,
  }}
              onSwiper={(swiper) => { 
                setCategorySwiper(swiper); 
 
                setIsCategoryStart( 
                  swiper.isBeginning, 
                ); 
 
                setIsCategoryEnd( 
                  swiper.isEnd, 
                ); 
              }} 
              onSlideChange={(swiper) => { 
                setIsCategoryStart( 
                  swiper.isBeginning, 
                ); 
 
                setIsCategoryEnd( 
                  swiper.isEnd, 
                ); 
              }} 
              onResize={(swiper) => { 
                setIsCategoryStart( 
                  swiper.isBeginning, 
                ); 
 
                setIsCategoryEnd( 
                  swiper.isEnd, 
                ); 
              }} 
              breakpoints={{ 
                480: { 
                  slidesPerView: 
                    mobileCategorySlides, 
                }, 
 
                768: { 
                  slidesPerView: 
                    tabletCategorySlides, 
                }, 
 
                1024: { 
                  slidesPerView: 
                    desktopCategorySlides, 
                }, 
              }} 
              className="category-swiper !pb-1 !pl-1 !pr-1" 
            > 
              {subcategories.map( 
                (subcategory) => { 
                  /* 
                   * The image, name and slug here all belong 
                   * to the SUBCATEGORY. 
                   */ 
                  const categoryImageUrl = 
                    subcategory.image_url 
                      ? subcategory.image_url 
                      : null; 
 
                  return ( 
                    <SwiperSlide 
                      key={subcategory.id} 
                      className="!h-auto" 
                    > 
                      <Link 
                        href={`/categories/${subcategory.slug}`} 
                        className="group relative flex h-[220px] w-full flex-col items-center overflow-hidden rounded-2xl border border-slate-200 bg-white p-4 text-center shadow-sm transition duration-300 hover:-translate-y-1 hover:border-[#F59E0B]/50 hover:shadow-lg" 
                      > 
                        {/* Decorative circle */} 
                        <div className="pointer-events-none absolute -right-8 -top-8 h-20 w-20 rounded-full bg-[#F59E0B]/10 transition duration-300 group-hover:scale-150" /> 
 
                        {/* Subcategory image */} 
                        <div className="relative mx-auto flex h-17 w-17 shrink-0 items-center justify-center overflow-hidden rounded-2xl bg-[#121358]/5 transition duration-300 group-hover:scale-105 group-hover:bg-white"> 
                          {categoryImageUrl && ( 
                            <img 
                              src={ 
                                categoryImageUrl 
                              } 
                              alt={ 
                                subcategory.name 
                              } 
                              className="h-full w-full object-contain p-2" 
                              onError={( 
                                event, 
                              ) => { 
                                event.currentTarget.style.display = 
                                  "none"; 
                              }} 
                            /> 
                          )} 
                        </div> 
 
                        {/* Subcategory name */} 
                        <span className="relative mt-4 flex h-10 w-full items-center justify-center text-sm font-bold leading-5 text-slate-800 transition group-hover:text-[#121358]"> 
                          <span className="line-clamp-2"> 
                            {subcategory.name} 
                          </span> 
                        </span> 
 
                        {/* Bottom text */} 
                        <span className="relative mt-2 inline-block text-xs font-semibold text-slate-400 transition group-hover:text-[#F59E0B]"> 
                          Explore products 
                        </span> 
                      </Link> 
                    </SwiperSlide> 
                  ); 
                }, 
              )} 
            </Swiper> 
 
            {/* Left arrow */} 
            <button 
              type="button" 
              aria-label="Previous categories" 
              onClick={() => 
                categorySwiper?.slidePrev() 
              } 
              disabled={isCategoryStart} 
              className="absolute -left-3 top-1/2 z-10 hidden h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full border border-slate-200 bg-white text-[#121358] shadow-md transition hover:bg-[#121358] hover:text-white disabled:pointer-events-none disabled:opacity-0 sm:-left-4 sm:flex" 
            > 
              <ChevronLeft 
                size={18} 
                strokeWidth={2.5} 
              /> 
            </button> 
 
            {/* Right arrow */} 
            <button 
              type="button" 
              aria-label="Next categories" 
              onClick={() => 
                categorySwiper?.slideNext() 
              } 
              disabled={isCategoryEnd} 
              className="absolute -right-3 top-1/2 z-10 hidden h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full border border-slate-200 bg-white text-[#121358] shadow-md transition hover:bg-[#121358] hover:text-white disabled:pointer-events-none disabled:opacity-0 sm:-right-4 sm:flex" 
            > 
              <ChevronRight 
                size={18} 
                strokeWidth={2.5} 
              /> 
            </button> 
          </div> 
        ) : ( 
          !error && ( 
            <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-10 text-center text-slate-500"> 
              No categories are currently 
              available. 
            </div> 
          ) 
        )} 
      </section> 
 
      {/* Products grouped by category */} 
      <section className="pb-14"> 
        <ProductsByCategory /> 
      </section> 
    </main> 
  ); 
} 
 
type ServiceItemProps = { 
  icon: ReactNode; 
  title: string; 
  description: string; 
}; 
 
function ServiceItem({ 
  icon, 
  title, 
  description, 
}: ServiceItemProps) { 
  return ( 
    <div className="flex items-center gap-3 border-b border-r border-slate-200 p-4 transition hover:bg-slate-50 sm:p-5 lg:border-b-0"> 
      <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[#F59E0B]/10 text-[#121358]"> 
        {icon} 
      </div> 
 
      <div className="min-w-0"> 
        <h3 className="text-sm font-bold text-[#121358]"> 
          {title} 
        </h3> 
 
        <p className="mt-0.5 text-xs text-slate-500"> 
          {description} 
        </p> 
      </div> 
    </div> 
  ); 
}