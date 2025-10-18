import React from "react";

interface SegmentedControlProps {
  value: string | number;
  onChange: (v: string | number) => void;
  className?: string;
  children?: React.ReactNode;
}

function SegmentedControlImpl({
  value,
  onChange,
  className,
  children,
}: SegmentedControlProps) {
  // children expected to be SegmentedControl.Item elements with prop value
  const items = React.Children.toArray(children).filter(
    Boolean,
  ) as React.ReactElement[];

  type ChildProps = { value?: string | number; children?: React.ReactNode };

  return (
    <div
      className={`inline-flex rounded-md overflow-hidden ${className || ""}`}
      role="tablist"
    >
      {items.map((child) => {
        const props = child.props as ChildProps;
        const val = props.value;
        const active = val === value;
        return (
          <button
            key={String(val)}
            role="tab"
            aria-selected={active}
            className={`px-3 py-1 text-sm border-r last:border-r-0 ${active ? "bg-background text-foreground" : "bg-muted text-muted-foreground"}`}
            onClick={() => onChange(val ?? "")}
          >
            {props.children}
          </button>
        );
      })}
    </div>
  );
}

const SegmentedControl = SegmentedControlImpl as typeof SegmentedControlImpl & {
  Item: (props: {
    children: React.ReactNode;
    value?: string | number;
  }) => React.ReactNode;
};

SegmentedControl.Item = ({ children }: { children: React.ReactNode }) =>
  children;

export { SegmentedControl };
export default SegmentedControl;
