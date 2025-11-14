import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddFixedTestsFeature1730400000000 implements MigrationInterface {
  name = 'AddFixedTestsFeature1730400000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Create fixed_tests table
    await queryRunner.query(`
      CREATE TABLE "fixed_tests" (
        "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        "code" varchar(50) UNIQUE NOT NULL,
        "name" varchar(255) NOT NULL,
        "description" text,
        "duration" integer,
        "is_active" boolean DEFAULT true,
        "order_index" integer,
        "configuration" jsonb NOT NULL,
        "created_at" timestamp DEFAULT now() NOT NULL,
        "updated_at" timestamp DEFAULT now() NOT NULL
      )
    `);

    await queryRunner.query(`
      COMMENT ON COLUMN "fixed_tests"."duration" IS 'Duration in minutes'
    `);

    await queryRunner.query(`
      COMMENT ON COLUMN "fixed_tests"."configuration" IS 'Test-specific configuration (scoring rules, normative tables, etc.)'
    `);

    // Create fixed_test_questions table
    await queryRunner.query(`
      CREATE TABLE "fixed_test_questions" (
        "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        "fixed_test_id" uuid NOT NULL,
        "question_number" integer NOT NULL,
        "question_text" text NOT NULL,
        "question_type" varchar(50) NOT NULL,
        "options" jsonb NOT NULL,
        "correct_answer" jsonb,
        "factor" varchar(10),
        "points" integer DEFAULT 1,
        "metadata" jsonb,
        "created_at" timestamp DEFAULT now() NOT NULL,
        "updated_at" timestamp DEFAULT now() NOT NULL,
        CONSTRAINT "fk_fixed_test_questions_fixed_test" FOREIGN KEY ("fixed_test_id")
          REFERENCES "fixed_tests"("id") ON DELETE CASCADE,
        CONSTRAINT "uq_fixed_test_question_number" UNIQUE ("fixed_test_id", "question_number")
      )
    `);

    await queryRunner.query(`
      COMMENT ON COLUMN "fixed_test_questions"."options" IS 'Question options/alternatives (format depends on question type)'
    `);

    await queryRunner.query(`
      COMMENT ON COLUMN "fixed_test_questions"."correct_answer" IS 'Expected correct answer (for Wonderlic, IC)'
    `);

    await queryRunner.query(`
      COMMENT ON COLUMN "fixed_test_questions"."factor" IS 'Factor/dimension (for 16PF: A-Q4, for DISC: D/I/S/C)'
    `);

    await queryRunner.query(`
      COMMENT ON COLUMN "fixed_test_questions"."points" IS 'Points for correct answer (mainly for Wonderlic)'
    `);

    await queryRunner.query(`
      COMMENT ON COLUMN "fixed_test_questions"."metadata" IS 'Additional metadata (polarity for 16PF, word group for DISC, etc.)'
    `);

    // Create worker_video_requirements table
    await queryRunner.query(`
      CREATE TABLE "worker_video_requirements" (
        "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        "worker_id" uuid NOT NULL,
        "video_url" varchar(500) NOT NULL,
        "video_duration" integer,
        "video_size" bigint,
        "status" varchar(50) DEFAULT 'pending_review',
        "review_notes" text,
        "reviewed_at" timestamp,
        "reviewed_by" uuid,
        "recorded_at" timestamp DEFAULT CURRENT_TIMESTAMP,
        "device_info" jsonb,
        "created_at" timestamp DEFAULT now() NOT NULL,
        "updated_at" timestamp DEFAULT now() NOT NULL,
        CONSTRAINT "fk_worker_video_requirements_worker" FOREIGN KEY ("worker_id")
          REFERENCES "workers"("id") ON DELETE CASCADE,
        CONSTRAINT "fk_worker_video_requirements_reviewer" FOREIGN KEY ("reviewed_by")
          REFERENCES "users"("id")
      )
    `);

    await queryRunner.query(`
      COMMENT ON COLUMN "worker_video_requirements"."video_duration" IS 'Duration in seconds'
    `);

    await queryRunner.query(`
      COMMENT ON COLUMN "worker_video_requirements"."video_size" IS 'File size in bytes'
    `);

    await queryRunner.query(`
      COMMENT ON COLUMN "worker_video_requirements"."device_info" IS 'Browser, device, OS information'
    `);

    // Add columns to test_responses table
    await queryRunner.query(`
      ALTER TABLE "test_responses"
        ADD COLUMN "fixed_test_id" uuid,
        ADD COLUMN "raw_scores" jsonb,
        ADD COLUMN "scaled_scores" jsonb,
        ADD COLUMN "interpretation" jsonb
    `);

    await queryRunner.query(`
      ALTER TABLE "test_responses"
        ADD CONSTRAINT "fk_test_responses_fixed_test" FOREIGN KEY ("fixed_test_id")
          REFERENCES "fixed_tests"("id")
    `);

    await queryRunner.query(`
      COMMENT ON COLUMN "test_responses"."raw_scores" IS 'Raw scores per factor/dimension (for 16PF, DISC, etc.)'
    `);

    await queryRunner.query(`
      COMMENT ON COLUMN "test_responses"."scaled_scores" IS 'Scaled scores (decatipos for 16PF, normalized for DISC, etc.)'
    `);

    await queryRunner.query(`
      COMMENT ON COLUMN "test_responses"."interpretation" IS 'Test interpretation results and categorizations'
    `);

    // Add column to test_answers table
    await queryRunner.query(`
      ALTER TABLE "test_answers"
        ADD COLUMN "fixed_test_question_id" uuid
    `);

    await queryRunner.query(`
      ALTER TABLE "test_answers"
        ADD CONSTRAINT "fk_test_answers_fixed_test_question" FOREIGN KEY ("fixed_test_question_id")
          REFERENCES "fixed_test_questions"("id")
    `);

    // Create indexes for performance
    await queryRunner.query(`
      CREATE INDEX "idx_fixed_tests_code" ON "fixed_tests"("code")
    `);

    await queryRunner.query(`
      CREATE INDEX "idx_fixed_test_questions_test_id" ON "fixed_test_questions"("fixed_test_id")
    `);

    await queryRunner.query(`
      CREATE INDEX "idx_worker_video_requirements_worker_id" ON "worker_video_requirements"("worker_id")
    `);

    await queryRunner.query(`
      CREATE INDEX "idx_worker_video_requirements_status" ON "worker_video_requirements"("status")
    `);

    await queryRunner.query(`
      CREATE INDEX "idx_test_responses_fixed_test_id" ON "test_responses"("fixed_test_id")
    `);

    await queryRunner.query(`
      CREATE INDEX "idx_test_answers_fixed_test_question_id" ON "test_answers"("fixed_test_question_id")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Drop indexes
    await queryRunner.query(`DROP INDEX "idx_test_answers_fixed_test_question_id"`);
    await queryRunner.query(`DROP INDEX "idx_test_responses_fixed_test_id"`);
    await queryRunner.query(`DROP INDEX "idx_worker_video_requirements_status"`);
    await queryRunner.query(`DROP INDEX "idx_worker_video_requirements_worker_id"`);
    await queryRunner.query(`DROP INDEX "idx_fixed_test_questions_test_id"`);
    await queryRunner.query(`DROP INDEX "idx_fixed_tests_code"`);

    // Remove column from test_answers
    await queryRunner.query(`
      ALTER TABLE "test_answers" DROP CONSTRAINT "fk_test_answers_fixed_test_question"
    `);
    await queryRunner.query(`ALTER TABLE "test_answers" DROP COLUMN "fixed_test_question_id"`);

    // Remove columns from test_responses
    await queryRunner.query(`
      ALTER TABLE "test_responses" DROP CONSTRAINT "fk_test_responses_fixed_test"
    `);
    await queryRunner.query(`
      ALTER TABLE "test_responses"
        DROP COLUMN "interpretation",
        DROP COLUMN "scaled_scores",
        DROP COLUMN "raw_scores",
        DROP COLUMN "fixed_test_id"
    `);

    // Drop tables
    await queryRunner.query(`DROP TABLE "worker_video_requirements"`);
    await queryRunner.query(`DROP TABLE "fixed_test_questions"`);
    await queryRunner.query(`DROP TABLE "fixed_tests"`);
  }
}
