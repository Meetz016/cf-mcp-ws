import { Env } from "@/types/env";
import { User } from "@/types/user";

export async function searchUser(env: Env, user_id: string) {
    console.log("inside searchUser....", user_id)
    const user = await env.DB.prepare("SELECT * FROM user WHERE id = ?")
        .bind(user_id)
        .all();
    console.log("user", user)
    return user;
}

export async function addUser(env: Env, user: User) {
    console.log("inside addUser....", user)
    //TODO: Add user to database
    const newUser = await env.DB.prepare("INSERT INTO user (id, email, profile_url, name) VALUES (?, ?, ?, ?) ")
        .bind(user.id, user.email, user.picture, user.name)
        .run();
    console.log("newUser", newUser)
    return newUser;
}

