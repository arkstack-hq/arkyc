import { auth as makeAuth } from '@arkstack/auth'

/** Shared Auth instance used across controllers (bearer JWT + personal access tokens). */
export const auth = makeAuth()
