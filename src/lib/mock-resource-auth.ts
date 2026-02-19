
// Mock implementation of resource-auth based on d.ts
export interface BaseUser {
    id: string;
    roles: string[];
}

export type Condition<TUser, TResource> = (
    user: TUser,
    resource?: TResource
) => boolean;

class AbilitiesBuilderImpl<TResources, TActions extends string, TUser extends BaseUser> {
    private rules: { action: TActions; resource: keyof TResources; condition?: Condition<TUser, any> }[] = [];

    addAbility<K extends keyof TResources>(
        action: TActions,
        resource: K,
        condition?: Condition<TUser, TResources[K]>
    ) {
        this.rules.push({ action, resource: resource as keyof TResources, condition });
        return this;
    }

    abilitiesForUser(user: TUser) {
        return {
            can: <K extends keyof TResources>(
                action: TActions,
                resource: K,
                instance?: TResources[K]
            ): boolean => {
                // Find matching rules
                const relevantRules = this.rules.filter(
                    (r) => r.action === action && r.resource === resource
                );

                // Check if any rule allows
                if (relevantRules.length === 0) return false;

                return relevantRules.some((r) => {
                    if (!r.condition) return true;
                    return r.condition(user, instance);
                });
            },
        };
    }
}

export function createAbilitiesBuilder<
    TResources extends Record<string, unknown>,
    TActions extends string,
    TUser extends BaseUser
>() {
    return new AbilitiesBuilderImpl<TResources, TActions, TUser>();
}

export function createCrudAbilitiesBuilder() {
    return new AbilitiesBuilderImpl();
}

export function composeAbilities(builders: any[]) {
    // Simple composition: merge rules?
    // For now returning first one or generic
    return builders[0];
}
