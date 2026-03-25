# Codebase Structure Index
*Auto-generated - DO NOT EDIT MANUALLY*

## Backend

### src/app/user/login/actions.ts
- `login` (constant, line 8)
- `parsed` (constant, line 19)
- `raw` (constant, line 14)
- `result` (constant, line 28)

### src/app/user/logout/actions.ts
- `logout` (constant, line 6)

### src/app/user/register/actions.ts
- `confirmPassword` (constant, line 30)
- `parsed` (constant, line 21)
- `raw` (constant, line 14)
- `register` (constant, line 8)
- `result` (constant, line 31)

### src/constants/index.ts
- `FOOL_INDEX` (constant, line 8)
- `FOOL_NUMEROLOGY_VALUE` (constant, line 9)
- `FOOL_ROOT` (constant, line 10)
- `MAJOR_ARCANA_COUNT` (constant, line 4)
- `MAJOR_ARCANA_MAX_INDEX` (constant, line 5)
- `MAJOR_ARCANA_THRESHOLD` (constant, line 14)
- `NUMBER_TO_WORD` (constant, line 23)
- `SINGLE_DIGIT_MAX` (constant, line 13)
- `SUIT_ALIASES` (constant, line 17)
- `WORD_TO_NUMBER` (constant, line 37)

### src/lib/api-client.ts
- `FASTAPI_URL` (constant, line 5)
- `accessMaxAge` (constant, line 15)
- `authenticatedFetch` (constant, line 63)
- `body` (constant, line 120)
- `body` (constant, line 96)
- `clearAuthCookies` (constant, line 47)
- `cookieStore` (constant, line 12)
- `cookieStore` (constant, line 49)
- `cookieStore` (constant, line 59)
- `data` (constant, line 102)
- `data` (constant, line 126)
- `getValidAccessToken` (constant, line 58)
- `isProduction` (constant, line 13)
- `makeRequest` (constant, line 76)
- `nowSeconds` (constant, line 14)
- `publicFetch` (constant, line 106)
- `refreshMaxAge` (constant, line 16)
- `res` (constant, line 86)
- `setAuthCookies` (constant, line 11)

### src/lib/cards.ts
- `TAROT_DECK` (constant, line 3)
- `TAROT_MAP` (constant, line 90)

### src/lib/crypto-random.ts
- `array` (constant, line 10)
- `array` (constant, line 20)
- `generateReversalArray` (function, line 62)
- `getSecureRandom` (function, line 9)
- `getSecureRandomBoolean` (function, line 29)
- `getSecureRandomInt` (function, line 18)
- `j` (constant, line 40)
- `min` (constant, line 19)
- `range` (constant, line 19)
- `result` (constant, line 38)
- `securePickN` (function, line 50)
- `secureShuffleArray` (function, line 37)
- `shuffled` (constant, line 54)

### src/lib/dateValidation.ts
- `DateParts` (interface, line 5)
- `ValidationResult` (interface, line 11)
- `day` (property, line 6)
- `error` (property, line 13)
- `isValid` (property, line 12)
- `isValidDate` (constant, line 19)
- `month` (property, line 7)
- `parseAndValidateDate` (constant, line 81)
- `parseDateInputs` (constant, line 62)
- `validateDateParts` (constant, line 32)
- `validation` (constant, line 95)
- `year` (property, line 8)

### src/lib/decanates.ts
- `DecanateEntry` (interface, line 3)
- `card` (property, line 6)
- `decanatesByMonth` (constant, line 10)
- `endDay` (property, line 5)
- `sign` (property, line 7)
- `startDay` (property, line 4)

### src/lib/session.ts
- `getCurrentUser` (constant, line 8)

### src/lib/significators.ts
- `SignificatorResult` (interface, line 155)
- `calculateSignificators` (constant, line 165)
- `card` (constant, line 142)
- `dayNumber` (property, line 156)
- `decanate` (property, line 159)
- `decanate` (constant, line 139)
- `getDayNumber` (constant, line 59)
- `getDecanate` (constant, line 132)
- `getLifeNumber` (constant, line 108)
- `getRelatedMajorArcana` (constant, line 45)
- `getRoot` (constant, line 32)
- `getZodiacSign` (constant, line 70)
- `lifeNumber` (property, line 158)
- `reduceToMajorArcana` (constant, line 20)
- `zodiacSign` (property, line 157)

### src/lib/validation/auth-schemas.ts
- `LoginInput` (alias, line 23)
- `RegisterInput` (alias, line 24)
- `loginSchema` (constant, line 3)
- `registerSchema` (constant, line 8)

### src/lib/zodiac.ts
- `ZodiacSign` (interface, line 1)
- `end_date` (property, line 4)
- `majorArcanaIndex` (property, line 5)
- `name` (property, line 2)
- `start_date` (property, line 3)
- `zodiacSigns` (constant, line 8)

### src/proxy.ts
- `FASTAPI_URL` (constant, line 5)
- `PROACTIVE_REFRESH_THRESHOLD` (constant, line 10)
- `PUBLIC_AUTH_ROUTES` (constant, line 4)
- `accessToken` (constant, line 38)
- `config` (constant, line 135)
- `data` (constant, line 109)
- `data` (constant, line 68)
- `isPublicAuthRoute` (constant, line 40)
- `loginUrl` (constant, line 52)
- `loginUrl` (constant, line 84)
- `nowSeconds` (constant, line 97)
- `pathname` (constant, line 37)
- `proxy` (constant, line 36)
- `refreshToken` (constant, line 39)
- `res` (constant, line 61)
- `response` (constant, line 112)
- `response` (constant, line 71)
- `response` (constant, line 86)
- `secondsRemaining` (constant, line 98)
- `setCookiesFromTokenResponse` (constant, line 13)
- `tokenExpiresAt` (constant, line 95)

### src/services/cardLookup.ts
- `CardNotFoundError` (class, line 6)
- `InvalidCardIndexError` (class, line 14)
- `constructor` (method, line 7)
- `constructor` (method, line 15)
- `findCardByName` (constant, line 25)
- `findCardByNameSafe` (constant, line 36)
- `getCardByIndex` (constant, line 44)
- `getCardByIndexSafe` (constant, line 54)
- `getMajorArcana` (constant, line 71)
- `getMinorArcana` (constant, line 78)
- `isMajorArcana` (constant, line 64)

### src/types/api.ts
- `ApiError` (interface, line 6)
- `ApiResult` (alias, line 12)
- `ApiSuccess` (interface, line 1)
- `data` (property, line 3)
- `message` (property, line 9)
- `ok` (property, line 7)
- `ok` (property, line 2)
- `status` (property, line 8)

### src/types/auth.ts
- `AuthContextValue` (interface, line 36)
- `AuthFormState` (interface, line 27)
- `LoginFormState` (interface, line 33)
- `MeResponse` (interface, line 18)
- `RegisterFormState` (interface, line 34)
- `TokenResponse` (interface, line 10)
- `User` (interface, line 1)
- `_id` (property, line 19)
- `access_token` (property, line 11)
- `access_token_expires_at` (property, line 14)
- `clearUser` (property, line 38)
- `createdAt` (property, line 6)
- `created_at` (property, line 23)
- `credits` (property, line 22)
- `credits` (property, line 5)
- `displayName` (property, line 4)
- `display_name` (property, line 21)
- `email` (property, line 20)
- `email` (property, line 3)
- `error` (property, line 29)
- `fieldErrors` (property, line 30)
- `id` (property, line 2)
- `mapMeResponseToUser` (constant, line 41)
- `refresh_token` (property, line 12)
- `refresh_token_expires_at` (property, line 15)
- `success` (property, line 28)
- `token_type` (property, line 13)
- `updatedAt` (property, line 7)
- `updated_at` (property, line 24)
- `user` (property, line 37)

### src/types/models.ts
- `TarotCardData` (interface, line 2)
- `idx` (property, line 3)
- `imageUrl` (property, line 5)
- `meaning` (property, line 6)
- `name` (property, line 4)
- `reversed` (property, line 8)
- `reversedMeaning` (property, line 7)


## Other

### eslint.config.mjs
- `__dirname` (constant, line 6)
- `__filename` (constant, line 5)
- `anonymousObject90a9df900105` (variable, line 8)
- `baseDirectory` (property, line 9)
- `compat` (constant, line 8)
- `eslintConfig` (variable, line 12)

### next.config.ts
- `headers` (constant, line 68)
- `nextConfig` (constant, line 50)
- `securityHeaders` (constant, line 4)

### postcss.config.mjs
- `config` (variable, line 1)
- `plugins` (property, line 2)

### scripts/ctags-to-markdown.js
- `anonymousObject5fd499590105` (variable, line 9)
- `anonymousObject5fd499590205` (variable, line 32)
- `file` (constant, line 27)
- `fileMap` (constant, line 15)
- `input` (property, line 10)
- `kind` (property, line 34)
- `line` (property, line 35)
- `name` (property, line 33)
- `other` (constant, line 49)
- `output` (property, line 11)
- `printFile` (function, line 62)
- `rl` (constant, line 9)
- `sortedFiles` (constant, line 46)
- `src` (constant, line 48)
- `tag` (constant, line 19)
- `terminal` (property, line 12)

