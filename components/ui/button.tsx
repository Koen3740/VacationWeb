type ButtonProps = {
  children: React.ReactNode;
  className?: string;
  href?: string;
} & React.ButtonHTMLAttributes<HTMLButtonElement>;

export function Button({ children, className = '', href, ...props }: ButtonProps) {
  const classes = `rounded-full px-4 py-2 text-sm font-semibold transition ${className}`;

  if (href) {
    return (
      <a href={href} className={classes}>
        {children}
      </a>
    );
  }

  return (
    <button className={classes} {...props}>
      {children}
    </button>
  );
}
