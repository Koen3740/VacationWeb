type DestinationBudgetProps = {
  title: string;
  body: string;
};

export function DestinationBudget({ title, body }: DestinationBudgetProps) {
  return (
    <section className="mt-10 rounded-[16px] bg-white p-5 ring-1 ring-[#E8E4DC] sm:p-6">
      <h2
        className="text-[1.15rem] font-semibold text-[#0A2D62]"
        style={{ fontFamily: 'var(--font-vw-serif), Georgia, serif' }}
      >
        {title}
      </h2>
      <p className="mt-2 text-[14px] leading-relaxed text-[#0A2D62]/88">{body}</p>
    </section>
  );
}
