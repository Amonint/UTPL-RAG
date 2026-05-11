import { AcademicCalendarLauncher } from '@/components/academic-calendar-launcher'
import { RagWorkbench } from '@/components/rag-workbench'

export default function HomePage() {
  return (
    <>
      <AcademicCalendarLauncher />
      <main className="mx-auto w-[min(calc(100%-20px),960px)] px-0 py-5 md:w-[min(calc(100%-32px),960px)] md:py-8">
      <section className="mb-5">
        <p className="m-0 text-2xl font-semibold tracking-tight text-obsidian md:text-3xl">UTPL</p>
      </section>

      <RagWorkbench />
    </main>
    </>
  )
}
