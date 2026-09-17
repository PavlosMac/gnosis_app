# Codebase Structure Index
*Auto-generated — exports + top-level declarations*

## Components

### src/components/AuthField.tsx `(client)`
- `AuthField` — component *default*
- `AuthFieldFrame` — component
- `AUTH_CONTROL_CLASS` — const
- `AUTH_CONTROL_STYLE` — const
- `AuthFieldProps` — interface
- `AuthFieldFrameProps` — interface

### src/components/AuthTextArea.tsx `(client)`
- `AuthTextArea` — component *default*
- `AuthTextAreaProps` — interface

### src/components/AuthPageShell.tsx
- `AuthPageShell` — component *default*
- `AuthErrorBanner` — component
- `AuthFootnote` — component
- `AuthLink` — component
- `AuthSubmitButton` — component
- `AuthPageShellProps` — interface

### src/components/InterpretationDisplay.tsx
- `InterpretationDisplay` — function *default*
- `InterpretationDisplayProps` — interface

### src/components/InterpretationModal.tsx `(client)`
- `InterpretationModal` — component *default*
- `InterpretationModalProps` — interface
- `ModalState` — alias

### src/components/KabbalahLayout.tsx
- `KabbalahLayout` — component *default*
- `CardSlot` — component
- `CardSlotProps` — interface
- `KabbalahLayoutProps` — interface

### src/components/OrnateFrame.tsx
- `OrnateFrame` — function *default*
- `OrnateFrameProps` — interface

### src/components/ProfileNav.tsx `(client)`
- `ProfileNav` — function *default*

### src/components/Reading.tsx
- `Reading` — component *default*
- `ReadingProps` — interface
- `SIGNIFICATOR_POSITIONS` — constant
- `TREE_OF_LIFE_POSITIONS` — constant

### src/components/SanctumModal.tsx `(client)`
- `SanctumModal` — component *default*
- `SanctumModalProps` — interface

### src/components/ShuffleAnimation.tsx `(client)`
- `ShuffleAnimation` — component *default*
- `ANIMATION_DURATION` — constant
- `CARD_COUNT` — constant
- `ShuffleAnimationProps` — interface

### src/components/ShuffledDeck.tsx
- `ShuffledDeck` — component *default*
- `ShuffledDeckProps` — interface

### src/components/SignificatorSection.tsx
- `SignificatorSectionProps` — interface
- `SignificatorSection` — component *default*

### src/components/SignificatorsLayout.tsx
- `SignificatorsLayout` — component *default*
- `SignificatorsLayoutProps` — interface

### src/components/TarotCard.tsx
- `TarotCard` — component *default*
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
- `PositionConfig` — interface
- `READING_SCROLL_DELAY` — constant
- `ReadingConfig` — interface
- `SHOW_READING_DELAY` — constant
- `TarotGameProps` — interface

### src/components/TarotLanding.tsx `(client)`
- `TarotLanding` — component *default*

### src/components/TarotPageLayout.tsx `(client)`
- `TarotPageLayout` — component *default*
- `TarotPageLayoutProps` — interface

## Pages & Layouts

### src/app/forgot-password/page.tsx `(client)`
- `ForgotPasswordPage` — component *default*

### src/app/reset-password/page.tsx
- `ResetPasswordPage` — component *default*
- `ResetPasswordPageProps` — interface

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

### src/app/reading/page.tsx
- `ReadingPage` — function *default*
- `STARS` — constant

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

### src/app/user/login/page.tsx
- `LoginPage` — component *default*

### src/app/user/profile/page.tsx
- `ProfilePage` — component *default*
- `ProfileRow` — component

### src/app/user/readings/[id]/page.tsx
- `ReadingDetailPage` — component *default*

### src/app/user/readings/page.tsx
- `ReadingsPage` — component *default*
- `PAGE_SIZE` — constant

### src/app/user/register/page.tsx `(client)`
- `RegisterPage` — component *default*

## Providers

### src/app/providers/auth-provider.tsx `(client)`
- `AuthProvider` — component
- `useAuth` — function
- `AuthContext` — component
- `AuthProviderProps` — interface

## Server Actions

### src/app/forgot-password/actions.ts `(server)`
- `requestPasswordReset` — function

### src/app/reset-password/actions.ts `(server)`
- `resetPassword` — function

### src/app/superadmin/actions.ts `(server)`
- `getUsers` — function

### src/app/user/interpret/actions.ts `(server)`
- `getInterpretation` — function

### src/app/user/login/actions.ts `(server)`
- `login` — function

### src/app/user/logout/actions.ts `(server)`
- `logout` — function

### src/app/user/readings/[id]/actions.ts `(server)`
- `getReading` — function

### src/app/user/readings/actions.ts `(server)`
- `getReadings` — function

### src/app/user/profile/actions.ts `(server)`
- `getDashboard` — function
- `requestPasswordResetForCurrentUser` — function
- `contactSupport` — function
- `DashboardResult` — type

### src/app/user/register/actions.ts `(server)`
- `register` — function

## Libraries

### src/lib/api-client.ts
- `authenticatedFetch` — function
- `publicFetch` — function
- `GNOSIS_API_BASE_URL` — constant
- `SAFE_MESSAGES` — constant

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

### src/lib/feature-flags.ts
- `isRegistrationEnabled` — function

### src/lib/session.ts `(server)`
- `getCurrentUser` — function

### src/lib/significator-conversion.ts
- `convertSignificatorsToReadingResult` — function
- `LIFE_NUMBER_INDEX_RE` — constant

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

### src/lib/password-reset.ts
- `requestPasswordResetEmail` — function

### src/lib/validation/auth-schemas.ts
- `loginSchema` — function
- `registerSchema` — function
- `forgotPasswordSchema` — function
- `resetPasswordSchema` — function
- `LoginInput` — type
- `RegisterInput` — type
- `ForgotPasswordInput` — type
- `ResetPasswordInput` — type

### src/lib/validation/interpret-schemas.ts
- `interpretCardSchema` — function
- `interpretRequestSchema` — function

### src/lib/validation/support-schemas.ts
- `contactSupportSchema` — function
- `SUPPORT_SUBJECT_MAX` — constant
- `SUPPORT_MESSAGE_MAX` — constant
- `ContactSupportInput` — type

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
- `ForgotPasswordFormState` — interface
- `ContactSupportFormState` — interface
- `ResetPasswordFormState` — interface
- `MessageResponse` — interface
- `AuthContextValue` — interface
- `UserResponse` — interface
- `PaginatedResponse` — interface
- `mapMeResponseToUser` — function
- `mapUserResponseToUser` — function

### src/types/interpret.ts
- `CardOrientation` — type
- `InterpretCardRequest` — interface
- `InterpretRequest` — interface
- `CardInterpretation` — interface
- `InterpretResponse` — interface
- `InterpretResult` — type

### src/types/models.ts
- `TarotCardData` — interface

### src/types/reading.ts
- `SelectedCard` — interface
- `ReadingResult` — interface
- `SavedCard` — interface
- `ReadingListItem` — interface
- `ReadingDetail` — interface
- `PaginatedReadings` — interface

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

### src/app/user/login/login-form.tsx `(client)`
- `LoginForm` — component *default*
- `LoginFormProps` — interface

### src/app/reset-password/reset-password-form.tsx `(client)`
- `ResetPasswordForm` — component *default*
- `ResetPasswordFormProps` — interface

### src/app/user/profile/ResetPasswordRequestButton.tsx `(client)`
- `ResetPasswordRequestButton` — component *default*

### src/app/user/profile/ContactSupportRow.tsx `(client)`
- `ContactSupportRow` — component *default*

### src/app/user/profile/ContactSupportModal.tsx `(client)`
- `ContactSupportModal` — component *default*
- `ContactSupportModalProps` — interface

### src/hooks/useGameReducer.ts
- `GamePhase` — type
- `GameAction` — type
- `useGameReducer` — function
- `getSelectedCards` — function
- `getReading` — function

### src/proxy.ts
- `proxy` — function
- `config` — function
- `GNOSIS_API_BASE_URL` — constant
- `PROACTIVE_REFRESH_THRESHOLD` — constant
- `PUBLIC_AUTH_ROUTES` — constant

