import {
    getFirestore,
    addDoc,
    collection,
    doc,
    deleteDoc,
    setDoc,
    getDoc,
    getDocs,
    query,
    where,
    type QueryConstraint
} from "firebase/firestore";
import { firebaseApp } from "./firebase";

export interface Review {
    recipeId: string;
    userId: string;
    rating: number;
    text?: string;
    id?: string;
}

export interface Like {
    recipeId: string;
    userId: string;
    id?: string;
}

export interface User {
    authId: string;
    id?: string;
}

export interface Save {
    recipeId: string;
    userId: string;
    id?: string;
}

export interface Recipe {
    id: string;
    title: string;
    instructions: string;
    ingredients: string[];
    authorId: string;
    tags: string[];
    averageRating: number;
    likes: number;
    prepTime: string;
    cookTime: string;
    servings: string;
    imageUri?: string;
}

// Use standard Firestore instance (default database on free tier)
export const db = getFirestore(firebaseApp);

// Get top 5 most popular tags across all recipes
export async function getTop5Tags(): Promise<string[]> {
    try {
        const recipesSnap = await getDocs(collection(db, "recipes"));
        const tagCounts: Record<string, number> = {};

        recipesSnap.forEach(d => {
            const tags: string[] = d.data().tags || [];
            tags.forEach(tag => {
                if (tag) {
                    tagCounts[tag] = (tagCounts[tag] || 0) + 1;
                }
            });
        });

        return Object.entries(tagCounts)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 5)
            .map(([tagName]) => tagName);
    } catch (err) {
        console.error("Error getting top tags:", err);
        return [];
    }
}

export async function publishRecipe(userId: string, recipe: Omit<Recipe, "id">): Promise<string> {
    const recipeRef = await addDoc(collection(db, "recipes"), {
        ...recipe,
        authorId: userId,
        averageRating: recipe.averageRating || 0,
        likes: recipe.likes || 0,
        createdAt: Date.now()
    });
    return recipeRef.id;
}

export async function getRecipe(recipeId: string): Promise<Recipe | null> {
    try {
        const recipeDocRef = doc(db, "recipes", recipeId);
        const docSnap = await getDoc(recipeDocRef);

        if (!docSnap.exists()) {
            return null;
        }

        const data = docSnap.data();

        // Calculate dynamic reviews average and likes count
        const [reviewsSnap, likesSnap] = await Promise.all([
            getDocs(collection(db, `recipes/${recipeId}/reviews`)),
            getDocs(query(collection(db, "likes"), where("recipeId", "==", recipeId)))
        ]);

        let calculatedRating = data.averageRating || 0;
        if (!reviewsSnap.empty) {
            const sum = reviewsSnap.docs.reduce((acc, d) => acc + (d.data().rating || 0), 0);
            calculatedRating = sum / reviewsSnap.size;
        }

        return {
            ...data,
            id: docSnap.id,
            averageRating: calculatedRating,
            likes: likesSnap.size,
        } as Recipe;
    } catch (err) {
        console.error(`Error fetching recipe ${recipeId}:`, err);
        return null;
    }
}

export async function deleteRecipe(recipeId: string) {
    await deleteDoc(doc(db, `recipes/${recipeId}`));
}

export async function addReview(recipeId: string, userId: string, rating: number, text?: string) {
    await addDoc(collection(db, `recipes/${recipeId}/reviews`), {
        recipeId,
        userId,
        rating,
        text: text || "",
        createdAt: Date.now()
    });
}

export async function likeRecipe(userId: string, recipeId: string) {
    const likeId = `${recipeId}_${userId}`;
    await setDoc(doc(db, "likes", likeId), {
        userId,
        recipeId,
        createdAt: Date.now()
    });
}

export async function unlikeRecipe(userId: string, recipeId: string) {
    const likeId = `${recipeId}_${userId}`;
    await deleteDoc(doc(db, "likes", likeId));
}

export async function isRecipeLikedByUser(userId: string, recipeId: string): Promise<boolean> {
    try {
        const likeId = `${recipeId}_${userId}`;
        const likeSnap = await getDoc(doc(db, "likes", likeId));
        return likeSnap.exists();
    } catch {
        return false;
    }
}

export async function queryRecipes(filters: {
    searchTerm?: string;
    minRating?: number;
    tags?: string[];
    authorId?: string;
    likedOnly?: boolean;
    sort?: string;
    userId?: string;
}): Promise<Recipe[]> {
    try {
        const constraints: QueryConstraint[] = [];

        if (filters.authorId) {
            constraints.push(where("authorId", "==", filters.authorId));
        }

        if (filters.tags && filters.tags.length > 0) {
            constraints.push(where("tags", "array-contains-any", filters.tags.slice(0, 10)));
        }

        const q = constraints.length > 0
            ? query(collection(db, "recipes"), ...constraints)
            : collection(db, "recipes");

        const snap = await getDocs(q);

        let recipes: Recipe[] = snap.docs.map(d => ({
            id: d.id,
            averageRating: 0,
            likes: 0,
            ...d.data()
        } as Recipe));

        // Filter by liked only if selected
        if (filters.likedOnly && filters.userId) {
            const userLikesSnap = await getDocs(
                query(collection(db, "likes"), where("userId", "==", filters.userId))
            );
            const likedRecipeIds = new Set(userLikesSnap.docs.map(d => d.data().recipeId));
            recipes = recipes.filter(r => likedRecipeIds.has(r.id));
        }

        // Text search filter across title, instructions, and ingredients
        if (filters.searchTerm) {
            const term = filters.searchTerm.toLowerCase();
            recipes = recipes.filter(r =>
                (r.title && r.title.toLowerCase().includes(term)) ||
                (r.instructions && r.instructions.toLowerCase().includes(term)) ||
                (r.ingredients && r.ingredients.some(i => i.toLowerCase().includes(term)))
            );
        }

        // Filter by min rating
        if (filters.minRating && filters.minRating > 0) {
            recipes = recipes.filter(r => (r.averageRating || 0) >= filters.minRating!);
        }

        // Sorting
        if (filters.sort) {
            switch (filters.sort) {
                case 'title':
                    recipes.sort((a, b) => (a.title || "").localeCompare(b.title || ""));
                    break;
                case 'rating':
                    recipes.sort((a, b) => (b.averageRating || 0) - (a.averageRating || 0));
                    break;
                case 'likes':
                    recipes.sort((a, b) => (b.likes || 0) - (a.likes || 0));
                    break;
            }
        }

        return recipes;
    } catch (err) {
        console.error("Error querying recipes:", err);
        return [];
    }
}
