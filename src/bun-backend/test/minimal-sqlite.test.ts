import { Database } from "bun:sqlite";
import { test, expect } from "bun:test";

test("Minimal bun:sqlite :memory: isolation test", () => {
    let db: Database | null = null;
    try {
        console.log("[Minimal Test] Initializing :memory: database...");
        db = new Database(":memory:");
        console.log(`[Minimal Test] DB filename: ${db.filename}`);

        console.log("[Minimal Test] Creating schema...");
        db.exec("CREATE TABLE items (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL);");
        console.log("[Minimal Test] Schema created.");

        const itemName = 'test_item';
        console.log(`[Minimal Test] Inserting item: ${itemName}`);
        db.run("INSERT INTO items (name) VALUES (?);", [itemName]);
        console.log("[Minimal Test] Item inserted.");

        console.log("[Minimal Test] Querying items...");
        const query = db.query("SELECT * FROM items;");
        const items = query.all() as { id: number, name: string }[];
        console.log(`[Minimal Test] Found items: ${JSON.stringify(items)}`);

        expect(items).toBeArrayOfSize(1);
        expect(items[0]).toBeDefined();
        expect(items[0].name).toBe(itemName); // Critical assertion

        console.log("[Minimal Test] Assertion passed.");

    } catch (error) {
        console.error("[Minimal Test] Error during test:", error);
        throw error; // Re-throw to fail the test
    } finally {
        if (db) {
            console.log("[Minimal Test] Closing database.");
            db.close();
        }
    }
}); 