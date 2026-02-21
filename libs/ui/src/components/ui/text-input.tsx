import { forwardRef } from "react";

import { Input } from "./input";

const TextInput = forwardRef<HTMLInputElement, React.ComponentProps<typeof Input>>((props, ref) => {
  return <Input ref={ref} type="text" {...props} />;
});
TextInput.displayName = "TextInput";

export { TextInput };
