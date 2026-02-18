export function serializeParams(
  params: Record<string, string | number | boolean | undefined | null>,
  options?: { skipEmpty?: boolean }
): URLSearchParams {
  const searchParams = new URLSearchParams();

  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null) continue;
    const textValue = String(value);
    if (options?.skipEmpty && textValue === '') continue;
    searchParams.set(key, textValue);
  }

  return searchParams;
}
