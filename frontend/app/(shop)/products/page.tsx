import ProductsByCategory from "@/components/products/ProductsByCategory";

export default function ProductsPage() {
  return (
    <main className="bg-white">
      {/* Hero banner */}
      <section className="relative overflow-hidden bg-[#111858]">
        {/* Grid texture */}
        <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.05)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.05)_1px,transparent_1px)] bg-[size:32px_32px]" />

        {/* Glow accents */}
        <div className="pointer-events-none absolute -left-20 -top-20 h-72 w-72 rounded-full bg-blue-500/20 blur-3xl" />
        <div className="pointer-events-none absolute -right-20 bottom-0 h-72 w-72 rounded-full bg-indigo-500/20 blur-3xl" />

        <div className="relative mx-auto flex max-w-7xl flex-col items-center px-4 py-20 text-center sm:px-6 lg:px-8">
          <span className="rounded-full bg-white/10 px-4 py-1.5 text-xs font-bold uppercase tracking-[0.2em] text-blue-300">
            ShopSphere Catalog
          </span>

          <h1 className="mt-5 text-5xl font-black tracking-tight text-white sm:text-6xl">
            Shop
          </h1>

          <p className="mt-4 max-w-xl text-sm leading-6 text-slate-300 sm:text-base">
            Laptops, smart devices, earbuds and accessories — everything you
            need, all in one place.
          </p>

         
        
        </div>

        {/* Bottom curve transition into content */}
        <div className="absolute inset-x-0 bottom-0 h-10 bg-gradient-to-t from-white/0 to-transparent" />
      </section>

      {/* Existing products section — untouched */}
      <ProductsByCategory />
    </main>
  );
}