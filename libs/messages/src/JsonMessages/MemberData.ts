import { z } from "zod";

export const MemberData = z.object({
  id: z.string(),
  name: z.string().nullable(),
  email: z.string().nullable(),
  visitCardUrl: z.string().nullable(), //Proto handle null here. If something goes wrong with personal area, this may be the issue
});

export type MemberData = z.infer<typeof MemberData>;
