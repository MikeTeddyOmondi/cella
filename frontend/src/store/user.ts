import { create } from 'zustand';
import { createJSONStorage, devtools, persist } from 'zustand/middleware';

import { config } from 'config';
import { immer } from 'zustand/middleware/immer';
import { client } from '~/api';
import { getMe } from '~/api/users';
import { User } from '~/types';

type PartialUser = Partial<User>;

interface UserState {
  user: User;
  lastUser: PartialUser;
  clearLastUser: () => void;
  setUser: (user: User) => void;
  getMe(): Promise<User | null>;
  signOut(): Promise<void>;
}

export const useUserStore = create<UserState>()(
  devtools(
    persist(
      immer((set, get) => ({
        user: null as unknown as User,
        lastUser: null as unknown as PartialUser,
        clearLastUser: () => {
          set((state) => {
            state.lastUser = null as unknown as User;
          });
        },
        setUser: (user) => {
          set((state) => {
            state.user = user;
            state.lastUser = { email: user.email, name: user.name, id: user.id, slug: user.slug };
          });
        },
        async getMe() {
          try {
            const user = await getMe();
            set({ user: user, lastUser: { email: user.email, name: user.name, id: user.id, slug: user.slug } });
            return user;
          } catch (error) {
            await get().signOut();
            throw error;
          }
        },
        async signOut() {
          set({ user: null as unknown as User });
          await client['sign-out'].$get();
        },
      })),
      {
        name: `${config.slug}-user`,
        partialize: (state) => ({
          user: state.user,
          lastUser: state.lastUser,
        }),
        storage: createJSONStorage(() => localStorage),
      },
    ),
  ),
);
