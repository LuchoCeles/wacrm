import { getRequestConfig } from 'next-intl/server';

export default getRequestConfig(async () => {
  // Read the locale from the environment, defaulting to Spanish.
  const locale = process.env.NEXT_PUBLIC_APP_LOCALE || 'es';

  let messages;
  try {
    messages = (await import(`../../messages/${locale}.json`)).default;
  } catch (error) {
    // Keep English as the safe fallback if a requested dictionary doesn't exist.
    messages = (await import(`../../messages/en.json`)).default;
  }

  return {
    locale,
    messages
  };
});
