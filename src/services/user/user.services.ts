import { User } from "@/types/user";
import { addUser, searchUser } from "@/repository/user/user.repository"; import { Env } from "@/types/env";
import { sign } from "hono/jwt";



export async function getToken(env: Env, user: User) {

    try {
        console.log("user", user.id)
        const isExists = await searchUser(env, user.id);

        if (isExists.results.length > 0) {
            const token = await sign({ id: user.id, email: user.email }, env.JWT_SECRET);
            return token;
        } else {
            //save user to database
            const signup = await addUser(env, user);
            console.log("inside signup....")
            if (signup.success) {
                const token = await sign({ id: user.id, email: user.email }, env.JWT_SECRET);
                return token;
            }
            return null;
        }
    } catch (error) {
        console.log("error", error)
        return null;
    }

}
