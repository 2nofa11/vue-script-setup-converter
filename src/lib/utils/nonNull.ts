/**
 * Copyright (c) 2021 Masaya Kazama. All Rights Reserved.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of https://github.com/miyaoka/vue-composition-converter.
 */

export const nonNull = <T>(item: T): item is NonNullable<T> => item != null;