declare module "resource-auth" {
  export interface BaseUser {
    id: string;
    roles: string[];
  }

  export type Condition<TUser, TResource> = (
    user: TUser,
    resource?: TResource
  ) => boolean;

  export interface AbilitiesBuilder<TResources, TActions extends string, TUser> {
    addAbility<K extends keyof TResources>(
      action: TActions,
      resource: K,
      condition?: Condition<TUser, TResources[K]>
    ): AbilitiesBuilder<TResources, TActions, TUser>;
    abilitiesForUser(user: TUser): Abilities<TResources, TActions>;
  }

  export interface Abilities<TResources, TActions extends string> {
    can<K extends keyof TResources>(
      action: TActions,
      resource: K,
      instance?: TResources[K]
    ): boolean;
  }

  export function createAbilitiesBuilder<
    TResources extends Record<string, unknown>,
    TActions extends string,
    TUser extends BaseUser
  >(): AbilitiesBuilder<TResources, TActions, TUser>;

  export function createCrudAbilitiesBuilder<
    TResources extends Record<string, unknown>,
    TUser extends BaseUser
  >(): AbilitiesBuilder<TResources, "create" | "read" | "update" | "delete", TUser>;

  export function composeAbilities<
    TResources extends Record<string, unknown>,
    TActions extends string,
    TUser extends BaseUser
  >(
    builders: AbilitiesBuilder<TResources, TActions, TUser>[]
  ): AbilitiesBuilder<TResources, TActions, TUser>;
}
