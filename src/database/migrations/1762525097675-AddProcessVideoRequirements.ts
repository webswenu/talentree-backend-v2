import { MigrationInterface, QueryRunner } from "typeorm";

export class AddProcessVideoRequirements1762525097675 implements MigrationInterface {
    name = 'AddProcessVideoRequirements1762525097675'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE "process_video_requirements" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "process_id" uuid NOT NULL, "is_required" boolean NOT NULL DEFAULT false, "max_duration" integer, "questions" jsonb, "instructions" text, "created_at" TIMESTAMP NOT NULL DEFAULT now(), "updated_at" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "UQ_6eb2803cf1d237d35aa32b77955" UNIQUE ("process_id"), CONSTRAINT "REL_6eb2803cf1d237d35aa32b7795" UNIQUE ("process_id"), CONSTRAINT "PK_f619c8cd4bba45a9131a58377ce" PRIMARY KEY ("id")); COMMENT ON COLUMN "process_video_requirements"."is_required" IS 'Whether video is required for this process'; COMMENT ON COLUMN "process_video_requirements"."max_duration" IS 'Maximum video duration in seconds'; COMMENT ON COLUMN "process_video_requirements"."questions" IS 'Array of questions to display during video recording'; COMMENT ON COLUMN "process_video_requirements"."instructions" IS 'Instructions for the worker before recording'`);
        await queryRunner.query(`ALTER TABLE "worker_video_requirements" ADD "process_id" uuid NOT NULL`);
        await queryRunner.query(`ALTER TABLE "worker_video_requirements" ADD "worker_process_id" uuid`);
        await queryRunner.query(`ALTER TABLE "worker_video_requirements" ADD CONSTRAINT "FK_9c157ad2a371e0d79903f4459b8" FOREIGN KEY ("process_id") REFERENCES "selection_processes"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "worker_video_requirements" ADD CONSTRAINT "FK_0072ead72e014494f83d1160168" FOREIGN KEY ("worker_process_id") REFERENCES "worker_processes"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "process_video_requirements" ADD CONSTRAINT "FK_6eb2803cf1d237d35aa32b77955" FOREIGN KEY ("process_id") REFERENCES "selection_processes"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "process_video_requirements" DROP CONSTRAINT "FK_6eb2803cf1d237d35aa32b77955"`);
        await queryRunner.query(`ALTER TABLE "worker_video_requirements" DROP CONSTRAINT "FK_0072ead72e014494f83d1160168"`);
        await queryRunner.query(`ALTER TABLE "worker_video_requirements" DROP CONSTRAINT "FK_9c157ad2a371e0d79903f4459b8"`);
        await queryRunner.query(`ALTER TABLE "worker_video_requirements" DROP COLUMN "worker_process_id"`);
        await queryRunner.query(`ALTER TABLE "worker_video_requirements" DROP COLUMN "process_id"`);
        await queryRunner.query(`DROP TABLE "process_video_requirements"`);
    }

}
