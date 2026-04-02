# Codebase Structure Index
*Auto-generated — exports + top-level declarations*

## Components

### src/components/AuthField.tsx `(client)`
- `AuthField` — component *default*
- `AuthFieldProps` — interface

### src/components/KabbalahLayout.tsx
- `KabbalahLayout` — component *default*
- `CardSlot` — component
- `CardSlotProps` — interface
- `KabbalahLayoutProps` — interface
- `SelectedCard` — interface

### src/components/LogoutButton.tsx
- `LogoutButton` — component *default*

### src/components/ProfileNav.tsx `(client)`
- `ProfileNav` — function *default*

### src/components/Reading.tsx
- `Reading` — component *default*
- `ReadingProps` — interface
- `SelectedCard` — interface

### src/components/ShuffleAnimation.tsx `(client)`
- `ShuffleAnimation` — component *default*
- `ANIMATION_DURATION` — constant
- `CARD_COUNT` — constant
- `ShuffleAnimationProps` — interface

### src/components/ShuffledDeck.tsx
- `ShuffledDeck` — function *default*
- `SelectedCard` — interface
- `ShuffledDeckProps` — interface

### src/components/ShuffledDeckMobile.tsx
- `ShuffledDeckMobile` — function *default*
- `SelectedCard` — interface
- `ShuffledDeckMobileProps` — interface

### src/components/SignificatorSection.tsx
- `SignificatorSectionProps` — interface
- `SignificatorSection` — component *default*

### src/components/TarotCard.tsx
- `TarotCard` — function *default*
- `TarotCardProps` — interface

### src/components/TarotChart.tsx `(client)`
- `TarotChart` — component *default*
- `AnimatedCardSection` — component
- `AnimatedCardSectionProps` — interface
- `REFRESH_INTERVAL` — constant
- `Section` — component
- `SectionProps` — interface

### src/components/TarotGame.tsx `(client)`
- `TarotGame` — function *default*
- `CARD_FLIP_BUFFER` — constant
- `CARD_FLIP_DURATION` — constant
- `DECK_SCROLL_DELAY` — constant
- `READING_SCROLL_DELAY` — constant
- `ReadingConfig` — interface
- `ReadingResult` — interface
- `SHOW_READING_DELAY` — constant
- `SelectedCard` — interface

### src/components/TarotLanding.tsx `(client)`
- `TarotLanding` — component *default*

### src/components/TarotPageLayout.tsx `(client)`
- `TarotPageLayout` — component *default*
- `TarotPageLayoutProps` — interface

## Pages & Layouts

### src/app/chart/page.tsx `(client)`
- `ChartPage` — function *default*

### src/app/guide/page.tsx `(client)`
- `GuidePage` — function *default*
- `Section` — component
- `SectionProps` — interface

### src/app/layout.tsx
- `metadata` — function
- `RootLayout` — function *default*

### src/app/not-found.tsx `(client)`
- `NotFound` — function *default*

### src/app/page.tsx `(client)`
- `TarotPage` — function *default*

### src/app/reading/page.tsx `(client)`
- `ReadingPage` — function *default*

### src/app/significators/page.tsx `(client)`
- `SignificatorsPage` — function *default*

### src/app/superadmin/layout.tsx
- `SuperadminLayout` — component *default*
- `SuperadminLayoutProps` — interface

### src/app/superadmin/page.tsx
- `SuperadminPage` — component *default*
- `PAGE_SIZE` — constant

### src/app/user/layout.tsx
- `UserLayout` — component *default*
- `UserLayoutProps` — interface

### src/app/user/login/page.tsx `(client)`
- `LoginPage` — component *default*

### src/app/user/profile/page.tsx
- `ProfilePage` — component *default*
- `ProfileRow` — component

### src/app/user/register/page.tsx `(client)`
- `RegisterPage` — component *default*

## Providers

### src/app/providers/auth-provider.tsx `(client)`
- `AuthProvider` — component
- `useAuth` — function
- `AuthContext` — component
- `AuthProviderProps` — interface

## Server Actions

### src/app/superadmin/actions.ts `(server)`
- `getUsers` — function

### src/app/user/login/actions.ts `(server)`
- `login` — function

### src/app/user/logout/actions.ts `(server)`
- `logout` — function

### src/app/user/register/actions.ts `(server)`
- `register` — function

## Libraries

### src/lib/api-client.ts
- `authenticatedFetch` — function
- `publicFetch` — function
- `FASTAPI_URL` — constant

### src/lib/cards.ts
- `TAROT_DECK` — constant
- `TAROT_MAP` — constant

### src/lib/crypto-random.ts
- `getSecureRandom` — function
- `getSecureRandomInt` — function
- `getSecureRandomBoolean` — function
- `secureShuffleArray` — function
- `securePickN` — function
- `generateReversalArray` — function

### src/lib/dateValidation.ts
- `DateParts` — interface
- `ValidationResult` — interface
- `isValidDate` — function
- `validateDateParts` — function
- `parseDateInputs` — function
- `parseAndValidateDate` — function

### src/lib/decanates.ts
- `DecanateEntry` — interface
- `decanatesByMonth` — function

### src/lib/session.ts `(server)`
- `getCurrentUser` — function

### src/lib/significators.ts
- `reduceToMajorArcana` — function
- `getRoot` — function
- `getRelatedMajorArcana` — function
- `getDayNumber` — function
- `getZodiacSign` — function
- `getLifeNumber` — function
- `getDecanate` — function
- `SignificatorResult` — interface
- `calculateSignificators` — function

### src/lib/validation/auth-schemas.ts
- `loginSchema` — function
- `registerSchema` — function
- `LoginInput` — type
- `RegisterInput` — type

### src/lib/zodiac.ts
- `zodiacSigns` — function
- `ZodiacSign` — interface

## Services

### src/services/cardLookup.ts
- `CardNotFoundError` — class
- `InvalidCardIndexError` — class
- `findCardByName` — function
- `findCardByNameSafe` — function
- `getCardByIndex` — function
- `getCardByIndexSafe` — function
- `isMajorArcana` — function
- `getMajorArcana` — function
- `getMinorArcana` — function

## Types

### src/types/api.ts
- `ApiSuccess` — interface
- `ApiError` — interface
- `ApiResult` — type

### src/types/auth.ts
- `User` — interface
- `TokenResponse` — interface
- `MeResponse` — interface
- `AuthFormState` — interface
- `LoginFormState` — interface
- `RegisterFormState` — interface
- `AuthContextValue` — interface
- `UserResponse` — interface
- `PaginatedResponse` — interface
- `mapMeResponseToUser` — function
- `mapUserResponseToUser` — function

### src/types/models.ts
- `TarotCardData` — interface

## Constants

### src/constants/index.ts
- `MAJOR_ARCANA_COUNT` — constant
- `MAJOR_ARCANA_MAX_INDEX` — constant
- `FOOL_INDEX` — constant
- `FOOL_NUMEROLOGY_VALUE` — constant
- `FOOL_ROOT` — constant
- `SINGLE_DIGIT_MAX` — constant
- `MAJOR_ARCANA_THRESHOLD` — constant
- `SUIT_ALIASES` — constant
- `NUMBER_TO_WORD` — constant
- `WORD_TO_NUMBER` — constant

## Infrastructure

### src/proxy.ts
- `proxy` — function
- `config` — function
- `FASTAPI_URL` — constant
- `PROACTIVE_REFRESH_THRESHOLD` — constant
- `PUBLIC_AUTH_ROUTES` — constant

