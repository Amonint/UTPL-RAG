import { RagWorkbench } from '@/components/rag-workbench'

export default function HomePage() {
  return (
    <main className="mx-auto w-[min(calc(100%-20px),960px)] px-0 py-5 md:w-[min(calc(100%-32px),960px)] md:py-8">
      <section className="mb-5 grid gap-3">
        <div className="text-sm leading-6 text-gravel">UTPL service-linked RAG</div>
        <h1 className="m-0 font-display text-[clamp(2.5rem,6vw,4rem)] font-normal leading-[1.05] tracking-[-0.04em] text-obsidian">
          24h
        </h1>
        <p className="m-0 max-w-[60ch] text-base leading-7 text-gravel">
          Pregunta por un trámite o servicio UTPL.
        </p>
      </section>

      <RagWorkbench />
    </main>
  )
}
