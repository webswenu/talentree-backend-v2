import { MigrationInterface, QueryRunner } from "typeorm";

export class AddStatusToTestResponse1763650898510 implements MigrationInterface {

    public async up(queryRunner: QueryRunner): Promise<void> {
        // Add status column
        await queryRunner.query(`
            ALTER TABLE "test_responses"
            ADD COLUMN "status" VARCHAR(50) DEFAULT 'completed'
            NOT NULL
        `);

        // Add comment to status column
        await queryRunner.query(`
            COMMENT ON COLUMN "test_responses"."status" IS
            'Status of test response: completed, insufficient_answers, abandoned'
        `);

        // Update existing records to have 'completed' status
        await queryRunner.query(`
            UPDATE "test_responses"
            SET "status" = 'completed'
            WHERE "isCompleted" = true
        `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        // Remove status column
        await queryRunner.query(`
            ALTER TABLE "test_responses" DROP COLUMN "status"
        `);
    }

}
