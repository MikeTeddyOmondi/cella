import { create } from 'zustand';
import Gleap from 'gleap';
import { createJSONStorage, devtools, persist } from 'zustand/middleware';

import { config } from 'config';
import { immer } from 'zustand/middleware/immer';
import { client } from '~/api';
import { getMe } from '~/api/users';
import type { User } from '~/types';

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
          // TODO: move to Gleap component and listen to user changes?
          if (Gleap.isUserIdentified()) {
            Gleap.updateContact({ email: user.email, name: user.name || user.email });
          } else {
            Gleap.identify(user.id, { email: user.email, name: user.name || user.email, createdAt: new Date(user.createdAt) });
          }

          set((state) => {
            state.user = user;
            state.lastUser = { email: user.email, name: user.name, id: user.id, slug: user.slug };
          });
        },
        async getMe() {
          try {
            const user = await getMe();
            get().setUser(user);
            return user;
          } catch (error) {
            await get().signOut();
            throw error;
          }
        },
        async signOut() {
          set({ user: null as unknown as User });
          Gleap.clearIdentity();
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
